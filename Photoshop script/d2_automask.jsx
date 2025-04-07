// PSDファイルのマスク処理スクリプト
// 指定したフォルダ内のPSDファイルを開き、_mask_レイヤーを使用して下のレイヤーにマスクを適用する

// デバッグモード設定
var DEBUG_MODE = true;

// 設定管理クラス
var SettingsManager = function() {
    // 設定ファイル名
    this.settingsFileName = "MaskProcessorSettings.txt";
    
    // 設定を保存するメソッド
    this.saveSettings = function(settings) {
        try {
            // スクリプトファイルと同じディレクトリに設定ファイルを保存
            var scriptFile = new File($.fileName);
            var settingsFile = new File(scriptFile.parent + "/" + this.settingsFileName);
            settingsFile.open("w");
            settingsFile.encoding = "UTF-8";
            
            // 各設定項目を一行ずつ書き込む
            settingsFile.writeln("inputFolder=" + settings.inputFolder);
            settingsFile.writeln("outputFolder=" + settings.outputFolder);
            settingsFile.writeln("invertMask=" + settings.invertMask);
            settingsFile.writeln("maskLayerName=" + settings.maskLayerName);
            
            settingsFile.close();
            Logger.debug("設定を保存しました: " + settingsFile.fsName);
            return true;
        } catch(e) {
            Logger.debug("設定の保存に失敗: " + e);
            return false;
        }
    };
    
    // 設定を読み込むメソッド
    this.loadSettings = function() {
        try {
            // スクリプトファイルと同じディレクトリから設定ファイルを読み込み
            var scriptFile = new File($.fileName);
            var settingsFile = new File(scriptFile.parent + "/" + this.settingsFileName);
            
            if (!settingsFile.exists) {
                Logger.debug("設定ファイルが存在しません");
                return null;
            }
            
            settingsFile.open("r");
            settingsFile.encoding = "UTF-8";
            var settings = {};
            
            // ファイルの各行を読み込み、キーと値に分割
            while (!settingsFile.eof) {
                var line = settingsFile.readln();
                var parts = line.split("=");
                if (parts.length == 2) {
                    var key = parts[0];
                    var value = parts[1];
                    
                    // invertMaskは論理値に変換
                    if (key === "invertMask") {
                        settings[key] = (value === "true");
                    } else {
                        settings[key] = value;
                    }
                }
            }
            
            settingsFile.close();
            Logger.debug("設定を読み込みました: " + this.objectToString(settings));
            return settings;
        } catch(e) {
            Logger.debug("設定の読み込みに失敗: " + e);
            return null;
        }
    };
    
    // オブジェクトを文字列に変換するメソッド（JSON.stringifyの代替）
    this.objectToString = function(obj) {
        if (!obj) return "null";
        var result = "{";
        var first = true;
        for (var key in obj) {
            if (!first) {
                result += ", ";
            }
            first = false;
            var value = obj[key];
            if (typeof value === "string") {
                value = '"' + value + '"';
            }
            result += key + ": " + value;
        }
        result += "}";
        return result;
    };
};

// ロガークラス
var Logger = (function() {
    // プライベート変数
    var debugMode = DEBUG_MODE;
    var debugLogFilePath = null;
    
    // 初期化メソッド
    function init() {
        var scriptFolder = new File($.fileName).parent;
        debugLogFilePath = scriptFolder + "/debug_log.txt";
        
        // デバッグログファイルを初期化
        var debugLogFile = new File(debugLogFilePath);
        debugLogFile.open("w");
        debugLogFile.encoding = "UTF-8";
        debugLogFile.writeln("デバッグログ開始: " + new Date());
        debugLogFile.writeln("Photoshopバージョン: " + app.version);
        debugLogFile.writeln("OS: " + $.os);
        debugLogFile.writeln("スクリプトパス: " + $.fileName);
        debugLogFile.close();
    }
    
    // デバッグログ関数
    function debug(message) {
        if (!debugMode) return;
        
        $.writeln(message);
        
        // デバッグログファイルへも書き込み
        try {
            var debugLogFile = new File(debugLogFilePath);
            debugLogFile.open("a");
            debugLogFile.encoding = "UTF-8";
            debugLogFile.writeln(new Date().toLocaleString() + ": " + message);
            debugLogFile.close();
        } catch(e) {
            // ログファイルへの書き込みエラーは無視
            $.writeln("ログファイル書き込みエラー: " + e);
        }
    }
    
    // ログファイルに書き込む関数
    function writeLog(logFile, message) {
        try {
            logFile.open("a");
            logFile.encoding = "UTF-8";
            logFile.writeln(message);
            logFile.close();
        } catch(e) {
            debug("ログへの書き込みに失敗: " + e);
        }
    }
    
    // 公開インターフェース
    return {
        init: init,
        debug: debug,
        writeLog: writeLog,
        setDebugMode: function(mode) {
            debugMode = !!mode;
        }
    };
})();

// ユーザーインターフェースを作成
function createDialog() {
    // 設定マネージャーのインスタンスを作成
    var settingsManager = new SettingsManager();
    
    // 保存された設定を読み込み
    var savedSettings = settingsManager.loadSettings();
    
    var dialog = new Window("dialog", "PSDファイルマスク処理");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 16;

    // 入力フォルダ選択
    var inputGroup = dialog.add("group");
    inputGroup.orientation = "row";
    inputGroup.alignChildren = ["left", "center"];
    inputGroup.spacing = 10;
    inputGroup.add("statictext", undefined, "入力フォルダ:");
    var inputFolderEdit = inputGroup.add("edittext", undefined, "");
    inputFolderEdit.preferredSize.width = 300;
    var inputBrowseButton = inputGroup.add("button", undefined, "参照...");

    // 出力フォルダ選択（オプション）
    var outputGroup = dialog.add("group");
    outputGroup.orientation = "row";
    outputGroup.alignChildren = ["left", "center"];
    outputGroup.spacing = 10;
    outputGroup.add("statictext", undefined, "出力フォルダ:");
    var outputFolderEdit = outputGroup.add("edittext", undefined, "");
    outputFolderEdit.preferredSize.width = 300;
    var outputBrowseButton = outputGroup.add("button", undefined, "参照...");
    dialog.add("statictext", undefined, "(空欄の場合は入力フォルダ/output に保存)");

    // マスクレイヤー名設定
    var maskNameGroup = dialog.add("group");
    maskNameGroup.orientation = "row";
    maskNameGroup.alignChildren = ["left", "center"];
    maskNameGroup.spacing = 10;
    maskNameGroup.add("statictext", undefined, "マスクレイヤー名:");
    var maskLayerNameEdit = maskNameGroup.add("edittext", undefined, "_mask_");
    maskLayerNameEdit.preferredSize.width = 300;
    dialog.add("statictext", undefined, "(空欄の場合は「_mask_」が適用されます)");

    // マスク反転オプション
    var invertMaskCheckbox = dialog.add("checkbox", undefined, "マスクを反転する");
    invertMaskCheckbox.value = false;
    
    // 設定を読み込んだ場合は値をセット
    if (savedSettings) {
        if (savedSettings.inputFolder) {
            inputFolderEdit.text = savedSettings.inputFolder;
        }
        if (savedSettings.outputFolder) {
            outputFolderEdit.text = savedSettings.outputFolder;
        }
        if (savedSettings.invertMask !== undefined) {
            invertMaskCheckbox.value = savedSettings.invertMask;
        }
        if (savedSettings.maskLayerName) {
            maskLayerNameEdit.text = savedSettings.maskLayerName;
        }
    }

    // ボタン
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignChildren = ["center", "center"];
    buttonGroup.spacing = 10;
    var cancelButton = buttonGroup.add("button", undefined, "キャンセル", {name: "cancel"});
    var okButton = buttonGroup.add("button", undefined, "実行", {name: "ok"});

    // 参照ボタンのイベント
    inputBrowseButton.onClick = function() {
        var folder = Folder.selectDialog("入力フォルダを選択");
        if (folder) {
            inputFolderEdit.text = folder.fsName;
        }
    };

    outputBrowseButton.onClick = function() {
        var folder = Folder.selectDialog("出力フォルダを選択");
        if (folder) {
            outputFolderEdit.text = folder.fsName;
        }
    };

    // ダイアログを表示して結果を返す
    if (dialog.show() == 1) {
        // マスクレイヤー名が空の場合はデフォルト値を設定
        var maskLayerName = maskLayerNameEdit.text;
        // 空または空白のみの場合はデフォルト値を設定（trim()の代わりに正規表現を使用）
        if (!maskLayerName || maskLayerName.replace(/^\s+|\s+$/g, "") === "") {
            maskLayerName = "_mask_";
        }
        
        var settings = {
            inputFolder: inputFolderEdit.text,
            outputFolder: outputFolderEdit.text,
            invertMask: invertMaskCheckbox.value,
            maskLayerName: maskLayerName
        };
        
        // 設定をファイルに保存
        var saved = settingsManager.saveSettings(settings);
        if (saved) {
            Logger.debug("設定の保存に成功しました");
        } else {
            Logger.debug("設定の保存に失敗しました");
        }
        
        return settings;
    } else {
        return null;
    }
}

// PSDファイルのリストを取得
function getPsdFiles(folderPath) {
    var folder = new Folder(folderPath);
    return folder.getFiles("*.psd");
}

// マスクレイヤーを処理する
function processMaskLayers(doc, invertMask, logFile, maskLayerName) {
    // 処理されたマスクカウント
    var processedCount = 0;
    // ファイルを開いた時に表示されていたレイヤーのリスト
    var visibleLayers = [];
    
    // ログ情報を追加
    Logger.debug("処理開始: " + doc.name);
    Logger.writeLog(logFile, "  ドキュメント情報: " + doc.width + "x" + doc.height + ", " + doc.bitsPerChannel + "bit, モード: " + doc.mode);
    Logger.writeLog(logFile, "  レイヤー数: " + doc.layers.length);
    
    // 全レイヤーの表示状態を保存し、非表示にする関数
    function hideAllLayers(layerSet) {
        Logger.writeLog(logFile, "    レイヤー表示状態保存");

        for (var i = 0; i < layerSet.layers.length; i++) {
            var layer = layerSet.layers[i];

            Logger.writeLog(logFile, "      " + layer.name + " / " + layer.visible);

            // レイヤーの表示状態を保存（後で復元するため）
            if(layer.visible){
                visibleLayers.push(layer);
            }
            // レイヤーを非表示に
            layer.visible = false;
            
            // レイヤーセットの場合は再帰的に処理
            if (layer.typename === "LayerSet") {
                hideAllLayers(layer);
            }
        }
    }
    
    // 全レイヤーの表示状態を復元する関数
    function restoreLayerVisibility(layerSet) {
        for (var i = 0; i < visibleLayers.length; i++) {
            visibleLayers[i].visible = true;
        }
    }
    
    // 最初に全レイヤーを非表示にする
    try {
        hideAllLayers(doc);
        Logger.debug("全レイヤーを非表示にしました");
    } catch(e) {
        Logger.debug("レイヤーの非表示化に失敗: " + e);
    }
    
    // 全レイヤーセットとレイヤーを検索
    function findMaskLayers(layerSet) {
        for (var i = 0; i < layerSet.layers.length; i++) {
            var layer = layerSet.layers[i];
            
            // レイヤーセットの場合は再帰的に処理
            if (layer.typename === "LayerSet") {
                findMaskLayers(layer);
            } 
            // マスクレイヤーを見つけた場合
            else if (layer.name.indexOf(maskLayerName) !== -1) {
                // マスクレイヤーのみを表示
                layer.visible = true;
                
                // マスクレイヤーを選択
                doc.activeLayer = layer;
                
                Logger.debug("マスクレイヤー処理中: " + layer.name);
                Logger.writeLog(logFile, "    マスクレイヤー検出: " + layer.name + " (種類: " + layer.typename + ")");
                
                try {
                    // 新しい方法：マスクレイヤーの画像をコピーして対象レイヤーのマスクに適用
                    try {
                        // 1. マスクレイヤーの画像をコピー
                        doc.activeLayer = layer;
                        Logger.debug("  マスクレイヤーをアクティブにしました: " + layer.name);
                        Logger.writeLog(logFile, "    マスクレイヤーをアクティブにしました: " + layer.name);
                        
                        // レイヤーの内容をコピー
                        app.activeDocument.activeLayer = layer;
                        app.activeDocument.selection.selectAll();
                        app.activeDocument.selection.copy();
                        app.activeDocument.selection.deselect();
                        Logger.debug("  マスクレイヤーの画像をコピーしました");
                        Logger.writeLog(logFile, "    マスクレイヤーの画像をコピーしました");
                        
                        // 2. 対象レイヤー（マスクレイヤーの一つ上）をアクティブにする
                        if (i > 0) {
                            var targetLayer = layerSet.layers[i - 1];
                            doc.activeLayer = targetLayer;
                            Logger.writeLog(logFile, "    ターゲットレイヤー: " + targetLayer.name + " (種類: " + targetLayer.typename + ")");
                            
                            try {
                                // 3. レイヤーマスクを作成（空のマスク）
                                var idmake = stringIDToTypeID("make");
                                var desc = new ActionDescriptor();
                                var idnew = stringIDToTypeID("new");
                                var idchannel = stringIDToTypeID("channel");
                                desc.putClass(idnew, idchannel);
                                var idat = stringIDToTypeID("at");
                                var ref = new ActionReference();
                                var idchannel = stringIDToTypeID("channel");
                                var idchannel = stringIDToTypeID("channel");
                                var idmask = stringIDToTypeID("mask");
                                ref.putEnumerated(idchannel, idchannel, idmask);
                                desc.putReference(idat, ref);
                                var idusing = stringIDToTypeID("using");
                                var iduserMaskEnabled = stringIDToTypeID("userMaskEnabled");
                                var idrevealAll = stringIDToTypeID("revealAll");
                                desc.putEnumerated(idusing, iduserMaskEnabled, idrevealAll);
                                executeAction(idmake, desc, DialogModes.NO);
                                Logger.debug("  空のレイヤーマスクを作成しました");
                                Logger.writeLog(logFile, "    空のレイヤーマスクを作成しました");
                                
                                // 4. マスクのチャンネルに画像を貼り付ける
                                // マスクチャンネルを表示
                                var idshow = stringIDToTypeID("show");
                                var desc2 = new ActionDescriptor();
                                var idnull = stringIDToTypeID("null");
                                var list = new ActionList();
                                var ref2 = new ActionReference();
                                var idchannel = stringIDToTypeID("channel");
                                var idordinal = stringIDToTypeID("ordinal");
                                var idtargetEnum = stringIDToTypeID("targetEnum");
                                ref2.putEnumerated(idchannel, idordinal, idtargetEnum);
                                list.putReference(ref2);
                                desc2.putList(idnull, list);
                                executeAction(idshow, desc2, DialogModes.NO);
                                
                                // 必要に応じてマスクを反転
                                if (invertMask) {
                                    // マスクを反転するためにペースト前に選択範囲を反転
                                    app.activeDocument.selection.selectAll();
                                    app.activeDocument.selection.invert();
                                    Logger.writeLog(logFile, "    マスク用の選択範囲を反転しました");
                                } else {
                                    app.activeDocument.selection.selectAll();
                                }
                                
                                // コピーした画像を貼り付け
                                var idpaste = stringIDToTypeID("paste");
                                var desc3 = new ActionDescriptor();
                                var idantiAlias = stringIDToTypeID("antiAlias");
                                var idantiAliasType = stringIDToTypeID("antiAliasType");
                                var idantiAliasNone = stringIDToTypeID("antiAliasNone");
                                desc3.putEnumerated(idantiAlias, idantiAliasType, idantiAliasNone);
                                var idas = stringIDToTypeID("as");
                                var idpixel = stringIDToTypeID("pixel");
                                desc3.putClass(idas, idpixel);
                                executeAction(idpaste, desc3, DialogModes.NO);
                                app.activeDocument.selection.deselect();
                                
                                Logger.debug("  マスクチャンネルに画像を貼り付けました");
                                Logger.writeLog(logFile, "    マスクチャンネルに画像を貼り付けました");
                                
                                // マスクチャンネルを非表示にする
                                var idhide = stringIDToTypeID("hide");
                                var desc4 = new ActionDescriptor();
                                var idnull = stringIDToTypeID("null");
                                var list2 = new ActionList();
                                var ref3 = new ActionReference();
                                var idchannel = stringIDToTypeID("channel");
                                var idordinal = stringIDToTypeID("ordinal");
                                var idtargetEnum = stringIDToTypeID("targetEnum");
                                ref3.putEnumerated(idchannel, idordinal, idtargetEnum);
                                list2.putReference(ref3);
                                desc4.putList(idnull, list2);
                                executeAction(idhide, desc4, DialogModes.NO);
                                
                                // RGBチャンネルに戻る
                                var idselect = stringIDToTypeID("select");
                                var desc5 = new ActionDescriptor();
                                var idnull = stringIDToTypeID("null");
                                var ref4 = new ActionReference();
                                var idchannel = stringIDToTypeID("channel");
                                var idchannel = stringIDToTypeID("channel");
                                var idRGB = stringIDToTypeID("RGB");
                                ref4.putEnumerated(idchannel, idchannel, idRGB);
                                desc5.putReference(idnull, ref4);
                                executeAction(idselect, desc5, DialogModes.NO);
                                
                                // ターゲットレイヤーを非表示にする
                                targetLayer.visible = false;
                                Logger.writeLog(logFile, "    ターゲットレイヤーを非表示にしました");
                                processedCount++;
                            } catch(e) {
                                Logger.debug("  レイヤーマスクの適用に失敗: " + e);
                                Logger.writeLog(logFile, "    レイヤーマスクの適用に失敗: " + e);
                                alert("レイヤー「" + targetLayer.name + "」へのマスク適用に失敗しました: " + e);
                            }
                        }
                    } catch(e) {
                        Logger.debug("  マスク処理中にエラー: " + e);
                        Logger.writeLog(logFile, "    マスク処理中にエラー: " + e);
                        alert("レイヤー「" + layer.name + "」の処理中にエラーが発生しました: " + e);
                    }
                    
                    // マスクレイヤーを非表示に
                    layer.visible = false;
                    Logger.writeLog(logFile, "    マスクレイヤーを非表示にしました");
                } catch(e) {
                    Logger.debug("  マスク処理中にエラー: " + e);
                    Logger.writeLog(logFile, "    マスク処理中にエラー: " + e);
                    alert("レイヤー「" + layer.name + "」の処理中にエラーが発生しました: " + e);
                }
            }
        }
    }
    
    // ドキュメントのトップレベルレイヤーから開始
    try {
        findMaskLayers(doc);
    } catch(e) {
        Logger.debug("重大なエラー: " + e);
        Logger.writeLog(logFile, "  重大なエラー: " + e);
        alert("レイヤー処理中に重大なエラーが発生しました: " + e);
    }
    
    // 最終的な選択範囲を解除
    try {
        app.activeDocument.selection.deselect();
    } catch(e) {
        // 無視
    }
    
    // レイヤーの表示状態を元に戻す
    try {
        restoreLayerVisibility(doc);
        Logger.debug("レイヤーの表示状態を復元しました");
    } catch(e) {
        Logger.debug("レイヤーの表示状態復元に失敗: " + e);
    }
    
    return processedCount;
}

// メイン実行関数
function main() {
    // ロガーを初期化
    Logger.init();
    
    // 実行時の環境情報をログに記録
    Logger.debug("スクリプト実行開始");
    
    // 設定マネージャーのインスタンスを作成
    var settingsManager = new SettingsManager();
    
    // ダイアログで設定を取得
    var settings = createDialog();
    if (!settings) {
        Logger.debug("ダイアログがキャンセルされました");
        return; // キャンセルされた場合
    }
    
    Logger.debug("設定が取得されました: " + settingsManager.objectToString(settings));
    
    // 入力フォルダをチェック
    if (!settings.inputFolder) {
        alert("入力フォルダを指定してください。");
        return;
    }
    
    var inputFolder = new Folder(settings.inputFolder);
    if (!inputFolder.exists) {
        alert("指定された入力フォルダが存在しません。");
        return;
    }
    
    // 出力フォルダをチェック
    var outputFolder;
    if (settings.outputFolder && settings.outputFolder.length > 0) {
        outputFolder = new Folder(settings.outputFolder);
        if (!outputFolder.exists) {
            var createFolder = confirm("指定された出力フォルダが存在しません。作成しますか？");
            if (createFolder) {
                if (!outputFolder.create()) {
                    alert("出力フォルダを作成できませんでした。");
                    return;
                }
            } else {
                return;
            }
        }
    } else {
        // 出力フォルダが指定されていない場合は、入力フォルダ内に「output」ディレクトリを作成
        outputFolder = new Folder(inputFolder.fsName + "/output");
        if (!outputFolder.exists) {
            if (!outputFolder.create()) {
                alert("出力フォルダを作成できませんでした。入力フォルダを使用します。");
                outputFolder = inputFolder;
            }
        }
    }
    
    // PSDファイルのリストを取得
    var psdFiles = getPsdFiles(settings.inputFolder);
    if (psdFiles.length === 0) {
        alert("指定されたフォルダにPSDファイルが見つかりません。");
        return;
    }
    
    // 処理進捗状況のログファイルを作成
    var logFile = new File(outputFolder.fsName + "/mask_process_log.txt");
    logFile.open("w");
    logFile.encoding = "UTF-8";
    logFile.writeln("マスク処理ログ - " + new Date().toLocaleString());
    logFile.writeln("入力フォルダ: " + settings.inputFolder);
    logFile.writeln("出力フォルダ: " + outputFolder.fsName);
    logFile.writeln("マスク反転: " + (settings.invertMask ? "はい" : "いいえ"));
    logFile.writeln("マスクレイヤー名: " + settings.maskLayerName);
    logFile.writeln("処理ファイル数: " + psdFiles.length);
    logFile.writeln("----------------------------");
    logFile.close();
    
    // 設定情報をローカルストレージに保存（再度保存して確実に保存）
    settingsManager.saveSettings(settings);
    
    // 各PSDファイルを処理
    var totalProcessed = 0;
    var fileProcessed = 0;
    
    for (var i = 0; i < psdFiles.length; i++) {
        try {
            // ログに進捗を書き込む
            logFile.open("a");
            logFile.encoding = "UTF-8";
            logFile.writeln("[" + (i+1) + "/" + psdFiles.length + "] " + psdFiles[i].name + " 処理中...");
            logFile.close();
            
            // ファイルを開く
            var docRef = app.open(psdFiles[i]);
            
            // マスクレイヤーを処理
            var processedCount = processMaskLayers(docRef, settings.invertMask, logFile, settings.maskLayerName);
            totalProcessed += processedCount;
            
            // ファイル名を生成（同じ名前で保存）
            var saveFile = new File(outputFolder.fsName + "/" + docRef.name);
            
            // PSDとして保存
            var psdSaveOptions = new PhotoshopSaveOptions();
            psdSaveOptions.embedColorProfile = true;
            psdSaveOptions.alphaChannels = true;
            psdSaveOptions.layers = true;
            
            docRef.saveAs(saveFile, psdSaveOptions, true, Extension.LOWERCASE);
            fileProcessed++;
            
            // ログに成功を書き込む
            Logger.writeLog(logFile, "  ✓ " + processedCount + "個のマスクを適用し保存しました: " + saveFile.fsName);
            
            // ドキュメントを閉じる
            docRef.close(SaveOptions.DONOTSAVECHANGES);
            Logger.writeLog(logFile, "  ドキュメントを閉じました");
        } catch(e) {
            // エラーをログに書き込む
            Logger.writeLog(logFile, "  ! エラー: " + e);
            
            alert("ファイル " + psdFiles[i].name + " の処理中にエラーが発生しました。\n" + e);
        }
    }
    
    // 処理結果を表示
    var resultMessage = "処理完了:\n" + 
                        "処理したファイル数: " + fileProcessed + "/" + psdFiles.length + "\n" +
                        "適用したマスク数: " + totalProcessed;
    
    Logger.debug(resultMessage.replace(/\n/g, " "));
    alert(resultMessage);
    
    // 最後にもう一度設定を保存（念のため）
    settingsManager.saveSettings(settings);
}

// スクリプト実行
main();
