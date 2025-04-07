import torch
import os
import numpy as np
import folder_paths
from PIL import Image
from psd_tools import PSDImage
from io import BytesIO
import logging

"""
汎用ヘルパー関数
"""
def create_pil_from_tensor(img_tensor, with_alpha=True):
    """テンソルからPIL画像を作成する（一時ファイルを使用せず）"""
    # numpy配列に変換
    if torch.is_tensor(img_tensor):
        img_array = img_tensor.cpu().numpy()
    else:
        img_array = img_tensor
        
    # 浮動小数点からuint8に変換（必要な場合）
    if img_array.dtype == np.float32 or img_array.dtype == np.float64:
        img_array = (img_array * 255).astype(np.uint8)
    
    # チャンネル数を確認
    if with_alpha:
        # RGBAとして扱う
        if img_array.shape[2] == 3:  # RGBの場合はアルファを追加
            alpha = np.full((img_array.shape[0], img_array.shape[1], 1), 255, dtype=np.uint8)
            img_array = np.concatenate((img_array, alpha), axis=2)
        pil_img = Image.fromarray(img_array, 'RGBA')
    else:
        # RGBのみとして扱う
        if img_array.shape[2] == 4:  # RGBAの場合はアルファを除去
            img_array = img_array[:, :, :3]
        pil_img = Image.fromarray(img_array, 'RGB')
        
    return pil_img


def extract_alpha_mask(img_tensor):
    """
    画像からアルファチャンネルを抽出し、マスクとアルファを除去した画像を返す
    
    戻り値:
    - alpha_mask: PIL Imageのグレースケールマスク
    - rgb_image: アルファチャンネルを除去したPIL Image (RGB)
    """
    if torch.is_tensor(img_tensor):
        img_array = img_tensor.cpu().numpy()
    else:
        img_array = img_tensor
        
    # 浮動小数点からuint8に変換（必要な場合）
    if img_array.dtype == np.float32 or img_array.dtype == np.float64:
        img_array = (img_array * 255).astype(np.uint8)
    
    # アルファチャンネルがあるか確認
    if img_array.shape[2] == 4:
        # アルファチャンネルを取得
        alpha = img_array[:, :, 3]
        # RGB画像を取得（アルファを除去）
        rgb_array = img_array[:, :, :3]
        # PIL画像として返す
        alpha_mask = Image.fromarray(alpha, 'L')
        rgb_image = Image.fromarray(rgb_array, 'RGB')
        return alpha_mask, rgb_image
    else:
        # アルファがない場合は白一色のマスクを返す
        height, width = img_array.shape[:2]
        alpha_mask = Image.new('L', (width, height), 255)
        # 元の画像はそのままRGBとして返す
        rgb_image = Image.fromarray(img_array, 'RGB')
        return alpha_mask, rgb_image


"""
D2 Apply Alpha Channel
アルファチャンネル付き画像を作成
"""
class D2_ApplyAlphaChannel:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mask": ("MASK",),
                "invert_mask": ("BOOLEAN", {"default": False})
            }
        }
    
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "apply_alpha_channel"
    CATEGORY = "D2/Image"
    
    def apply_alpha_channel(self, image, mask, invert_mask=False):
        # バッチ次元を処理 - 単一画像の場合、バッチ次元を追加
        batch_size = image.shape[0]
        
        # 画像の寸法を取得
        _, height, width, channels = image.shape
        
        # マスクの形状を確認し、適切に処理
        # print(f"マスク形状: {mask.shape}, 次元数: {len(mask.shape)}") # デバッグ用出力

        # マスクの形状に応じて処理を分岐
        if len(mask.shape) == 2:  # 単一マスク (H, W)
            # 2次元マスクの場合、バッチとして拡張
            processed_mask = mask.unsqueeze(0).expand(batch_size, height, width)
            
        elif len(mask.shape) == 3:
            if mask.shape[0] == batch_size:  # バッチマスク (B, H, W)
                # すでにバッチ化されている場合はそのまま使用
                processed_mask = mask
            else:  # 単一マスク + チャンネル次元 (1, H, W)
                # バッチ次元に拡張
                processed_mask = mask.expand(batch_size, height, width)
                
        elif len(mask.shape) == 4:  # バッチ+チャンネル次元 (B, 1, H, W)
            # チャンネル次元をスクイーズ
            processed_mask = mask.squeeze(1)
            
        elif len(mask.shape) == 5:  # 複雑なテンソル形状 (B, 1, 1, H, W)
            # 余分な次元をスクイーズ
            processed_mask = mask.squeeze(1).squeeze(1)
            
        else:
            # 対応できない場合はリサイズして強制的に形状を合わせる
            logging.warning(f"警告: 予期しないマスク形状 {mask.shape} です。リサイズを試みます")
            # 一度平坦化してからリサイズ
            processed_mask = torch.nn.functional.interpolate(
                mask.reshape(batch_size, 1, -1, width).float(), # .float() を追加して型エラーを回避
                size=(height, width),
                mode='bilinear'
            ).squeeze(1)
        
        # リサイズしてサイズを画像に合わせる（必要な場合）
        if processed_mask.shape[1] != height or processed_mask.shape[2] != width:
            processed_mask = torch.nn.functional.interpolate(
                processed_mask.unsqueeze(1).float(),
                size=(height, width),
                mode='bilinear'
            ).squeeze(1)
        
        # 要求された場合はマスクを反転（1.0が透明に、0.0が不透明になる）
        if invert_mask:
            processed_mask = 1.0 - processed_mask
        
        # RGBAチャンネルを持つ出力テンソルを作成
        output = torch.zeros((batch_size, height, width, 4), dtype=image.dtype, device=image.device)
        
        # 入力画像からRGBチャンネルをコピー
        output[..., :3] = image[..., :3]
        
        # 処理済みマスクをアルファチャンネルとして適用
        output[..., 3] = processed_mask
        
        return (output,)


"""
D2 Save PSD
透明度を持つRGBA画像をPSDファイルとして保存するためのComfyUIカスタムノード
バッチ内の全画像を1つのPSDファイルの複数レイヤーとして保存
"""
class D2_SavePSD:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "filename_prefix": ("STRING", {"default": "ComfyUI"}),
                "file_mode": (["single_file", "multi_file"],),
                "alpha_name": ("STRING", {"default": "_mask_"}),
                "alpha_name_mode": (["simple", "suffix"],)
            }
        }
    
    RETURN_TYPES = ()
    FUNCTION = "save_rgba_psd"
    OUTPUT_NODE = True
    CATEGORY = "D2/Image"
    
    def save_rgba_psd(self, images, filename_prefix, file_mode, alpha_name="_mask_", alpha_name_mode="simple"):
        # ファイル名とパスを生成
        full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(
            filename_prefix, self.output_dir, images[0].shape[1], images[0].shape[0])

        # # ディレクトリが存在しない場合は作成
        # os.makedirs(full_output_folder, exist_ok=True)
        
        # 画像の寸法を取得
        batch_size, height, width, channels = images.shape
        
        try:
            # APIをインポート
            from psd_tools.api.layers import PixelLayer
            
            if file_mode == "single_file":
                # 単一ファイルモード: すべての画像を1つのPSDファイルに保存
                # 新しい空のPSDを作成
                psd = PSDImage.new('RGB', (width, height))
                
                # 逆順でレイヤーを処理（最後の画像が一番上のレイヤーになる）
                # この方法では一時ファイルを使用せずにメモリ内で処理
                for batch_number, img_tensor in enumerate(reversed(images)):
                    layer_name = f"Layer {batch_number+1}"
                    
                    # アルファマスクとRGB画像を取得
                    alpha_mask, rgb_image = extract_alpha_mask(img_tensor)
                    
                    # アルファ名を設定
                    alpha_layer_name = alpha_name
                    if alpha_name_mode == "suffix":
                        alpha_layer_name = f"{layer_name}_{alpha_name}"
                    
                    # まずアルファマスクがあれば追加（こちらが先に来るように）
                    if channels == 4:
                        # alpha_maskはグレースケール（L）モードのPIL画像
                        alpha_rgb = alpha_mask.convert("RGB")
                        alpha_layer = PixelLayer.frompil(alpha_rgb, psd)
                        alpha_layer.name = alpha_layer_name
                        psd.append(alpha_layer)
                    
                    # 次にRGBレイヤーを追加
                    # PILのRGB画像をPSDレイヤーに直接変換
                    rgb_layer = PixelLayer.frompil(rgb_image, psd)
                    rgb_layer.name = layer_name
                    psd.append(rgb_layer)

                # 保存先のファイルパスを生成
                filename_with_batch_num = filename.replace("%batch_num%", str(batch_number))
                file = f"{filename_with_batch_num}_{counter:05}_.psd"

                # PSDを保存
                psd.save(os.path.join(full_output_folder, file))
                
                logging.info(f"PSDファイルが正常に保存されました: {file}")
            
            else:  # file_mode == "multi_file"
                # 複数ファイルモード: 各画像を個別のPSDファイルに保存
                for batch_number, img_tensor in enumerate(images):
                    # 新しい空のPSDを作成
                    psd = PSDImage.new('RGB', (width, height))
                    
                    # アルファマスクとRGB画像を取得
                    alpha_mask, rgb_image = extract_alpha_mask(img_tensor)
                    
                    # レイヤー名を設定
                    layer_name = f"Layer 1"  # 各ファイルには1つのレイヤーのみ
                    
                    # アルファ名を設定
                    alpha_layer_name = alpha_name
                    if alpha_name_mode == "suffix":
                        alpha_layer_name = f"{layer_name}_{alpha_name}"
                    
                    # まずアルファマスクがあれば追加
                    if channels == 4:
                        # alpha_maskはグレースケール（L）モードのPIL画像
                        alpha_rgb = alpha_mask.convert("RGB")
                        alpha_layer = PixelLayer.frompil(alpha_rgb, psd)
                        alpha_layer.name = alpha_layer_name
                        psd.append(alpha_layer)
                    
                    # 次にRGBレイヤーを追加
                    rgb_layer = PixelLayer.frompil(rgb_image, psd)
                    rgb_layer.name = layer_name
                    psd.append(rgb_layer)
                    
                    # 保存先のファイルパスを生成（バッチ番号を含む）
                    filename_with_batch_num = filename.replace("%batch_num%", str(batch_number))
                    file = f"{filename_with_batch_num}_{counter:05}_{batch_number}.psd"
                    
                    # PSDを保存
                    psd.save(os.path.join(full_output_folder, file))
                    
                    logging.info(f"PSDファイル {batch_number+1}/{batch_size} が正常に保存されました: {file}")
            
        except Exception as e:
            logging.warning(f"PSD保存中にエラーが発生: {str(e)}")
            logging.warning("代替方法としてPNG形式で保存します...")
            
            # 代替方法: 個別のPNGとして保存
            for i, img_tensor in enumerate(images):
                try:
                    img_pil = create_pil_from_tensor(img_tensor)
                    alt_file = f"{filename.replace('%batch_num%', str(i))}_{counter:05}_.png"
                    alt_path = os.path.join(full_output_folder, alt_file)
                    img_pil.save(alt_path)
                except Exception as alt_e:
                    logging.warning(f"PNG保存にも失敗: {str(alt_e)}")

        # 空の辞書を返して NoneType エラーを回避
        return {}


"""
D2 Extract Alpha
画像からアルファチャンネルをマスクとして抽出するノード
"""
class D2_ExtractAlpha:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            }
        }
    
    RETURN_TYPES = ("MASK", "IMAGE")
    FUNCTION = "extract_alpha"
    CATEGORY = "D2/Image"

    def extract_alpha(self, image):
        # バッチ次元を処理
        batch_size = image.shape[0]
        
        # バッチ内の各画像に対してアルファチャンネルを抽出
        alpha_tensors = []
        rgb_alpha_tensors = []
        
        for i in range(batch_size):
            # 現在の画像
            current_image = image[i]

            # 汎用関数を使用してアルファマスクとRGB画像を取得
            alpha_pil, rgb_pil = extract_alpha_mask(current_image)

            # --- アルファマスク処理 ---
            alpha_np = np.array(alpha_pil)
            # PIL -> NumPy -> Tensor (元の向きを維持)
            alpha_tensor = torch.from_numpy(alpha_np).float() / 255.0 # 形状: (高さ, 幅)

            # --- RGB画像処理 ---
            rgb_np = np.array(rgb_pil)
            # PIL -> NumPy -> Tensor (元の向きを維持)
            rgb_tensor = torch.from_numpy(rgb_np).float() / 255.0 # 形状: (高さ, 幅, 3)

            # 2番目の出力 (IMAGE型) 用のRGBAテンソルを作成
            if rgb_tensor.shape[-1] == 3:
                height, width, _ = rgb_tensor.shape
                rgb_alpha_tensor = torch.ones((height, width, 4), # アルファを1で初期化
                                             dtype=rgb_tensor.dtype,
                                             device=rgb_tensor.device)
                rgb_alpha_tensor[..., :3] = rgb_tensor # RGBチャンネルをコピー
            elif rgb_tensor.shape[-1] == 4: # extract_alpha_maskが正しく動作していれば、これは起こらないはずです
                 # もし入力が何らかの理由でRGBAだった場合、そのまま使用しますが、アルファが不透明であることを確認しますか？
                 # それとも入力を信頼しますか？現時点では入力を信頼します。
                 logging.warning("警告: extract_alpha_maskから派生したrgb_tensorが予期せず4チャンネルを持っていました。そのまま使用します。")
                 rgb_alpha_tensor = rgb_tensor
            else:
                 raise ValueError(f"extract_alpha_maskからのrgb_tensorで予期しないチャンネル数です: {rgb_tensor.shape[-1]}")
            
            # リストに追加
            alpha_tensors.append(alpha_tensor)
            rgb_alpha_tensors.append(rgb_alpha_tensor)
        
        # テンソルをスタックしてバッチ次元を復元
        stacked_alpha = torch.stack(alpha_tensors) # 形状: (バッチ, 高さ, 幅)
        stacked_rgb_alpha = torch.stack(rgb_alpha_tensors) # 形状: (バッチ, 高さ, 幅, 4)

        # MASKテンソルとIMAGEテンソルを返す
        return (stacked_alpha, stacked_rgb_alpha)


NODE_CLASS_MAPPINGS = {
    "D2 Apply Alpha Channel": D2_ApplyAlphaChannel,
    "D2 Save PSD": D2_SavePSD,
    "D2 Extract Alpha": D2_ExtractAlpha
}


