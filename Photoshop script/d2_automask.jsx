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
        for (var i = 0; i < layerSet.layers.length; i++) {
            var layer = layerSet.layers[i];
            // レイヤーの表示状態を保存（後で復元するため）
            if(layer.visible){
                visibleLayers.push(layer);
            }
            // レイヤーを非表示に
            layer.visible = false;
            Logger.writeLog(logFile, "レイヤー表示状態保存: " + layer.name + " / " + layer.wasVisible);
            
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
                    // 選択範囲を作成 - ScriptingListenerから記録したコードを使用
                    try {
                        // ドキュメントでレイヤーを選択
                        doc.activeLayer = layer;
                        
                        // レイヤーのRGBチャンネルから選択範囲を作成（ScriptingListenerの記録に基づく）
                        var idset = stringIDToTypeID("set");
                        var desc = new ActionDescriptor();
                        var idnull = stringIDToTypeID("null");
                        var ref1 = new ActionReference();
                        var idchannel = stringIDToTypeID("channel");
                        var idselection = stringIDToTypeID("selection");
                        ref1.putProperty(idchannel, idselection);
                        desc.putReference(idnull, ref1);
                        var idto = stringIDToTypeID("to");
                        var ref2 = new ActionReference();
                        var idchannel = stringIDToTypeID("channel");
                        var idchannel = stringIDToTypeID("channel");
                        var idRGB = stringIDToTypeID("RGB");
                        ref2.putEnumerated(idchannel, idchannel, idRGB);
                        desc.putReference(idto, ref2);
                        executeAction(idset, desc, DialogModes.NO);
                        
                        Logger.debug("  ScriptingListener記録コードで選択範囲の作成に成功しました");
                        Logger.writeLog(logFile, "    選択範囲の作成に成功");
                    } catch(e) {
                        Logger.debug("  選択範囲作成エラー (ScriptingListener方式): " + e);
                        Logger.writeLog(logFile, "    選択範囲作成エラー: " + e);
                        
                        // 代替の選択方法を試す
                        try {
                            // 透明度を選択 - 別のAPI方法を試す
                            var idSet = charIDToTypeID("setd");
                            var desc = new ActionDescriptor();
                            var idNull = charIDToTypeID("null");
                            var ref = new ActionReference();
                            var idChnl = charIDToTypeID("Chnl");
                            var idfsel = charIDToTypeID("fsel");
                            ref.putProperty(idChnl, idfsel);
                            desc.putReference(idNull, ref);
                            var idTo = charIDToTypeID("T   ");
                            var refTo = new ActionReference();
                            var idChnl = charIDToTypeID("Chnl");
                            var idTrsp = charIDToTypeID("Trsp");
                            refTo.putEnumerated(idChnl, idChnl, idTrsp);
                            desc.putReference(idTo, refTo);
                            app.executeAction(idSet, desc, DialogModes.NO);
                            Logger.debug("  代替選択範囲の作成に成功しました");
                            Logger.writeLog(logFile, "    代替選択範囲の作成に成功");
                        } catch(e2) {
                            Logger.debug("  選択範囲作成エラー2: " + e2);
                            Logger.writeLog(logFile, "    すべての選択範囲作成方法が失敗: " + e2);
                            alert("レイヤー「" + layer.name + "」から選択範囲を作成できませんでした。");
                            continue; // 次のレイヤーに進む
                        }
                    }
                    
                    // 必要に応じて反転
                    if (invertMask) {
                        app.activeDocument.selection.invert();
                        Logger.writeLog(logFile, "    選択範囲を反転しました");
                    }
                    
                    // マスクレイヤーの上のレイヤーを選択（存在する場合）
                    if (i > 0) {
                        var targetLayer = layerSet.layers[i - 1];
                        doc.activeLayer = targetLayer;
                        Logger.writeLog(logFile, "    ターゲットレイヤー: " + targetLayer.name + " (種類: " + targetLayer.typename + ")");
                        
                        // レイヤーマスクを追加 - ScriptingListenerから記録したコードに近い方法
                        try {
                            // Photoshopでレイヤーマスクを追加する基本コマンド
                            var idMk = charIDToTypeID("Mk  ");
                            var desc = new ActionDescriptor();
                            var idNw = charIDToTypeID("Nw  ");
                            var idChnl = charIDToTypeID("Chnl");
                            desc.putClass(idNw, idChnl);
                            var idAt = charIDToTypeID("At  ");
                            var ref = new ActionReference();
                            var idChnl = charIDToTypeID("Chnl");
                            var idMsk = charIDToTypeID("Msk ");
                            ref.putEnumerated(idChnl, idChnl, idMsk);
                            desc.putReference(idAt, ref);
                            
                            // 選択範囲を使用
                            var idUsng = charIDToTypeID("Usng");
                            var idUsrM = charIDToTypeID("UsrM");
                            var idRvlS = charIDToTypeID("RvlS");
                            desc.putEnumerated(idUsng, idUsrM, idRvlS);
                            
                            // コマンド実行
                            executeAction(idMk, desc, DialogModes.NO);
                            
                            Logger.debug("  レイヤーマスクの適用に成功しました");
                            Logger.writeLog(logFile, "    レイヤーマスクの適用に成功");
                            // ターゲットレイヤーを非表示にする
                            targetLayer.visible = false;
                            Logger.writeLog(logFile, "    ターゲットレイヤーを非表示にしました");
                            processedCount++;
                        } catch(e) {
                            Logger.debug("  レイヤーマスクの適用に失敗: " + e);
                            Logger.writeLog(logFile, "    レイヤーマスクの適用に失敗: " + e);
                            
                            // 別の方法を試す - より単純なコード
                            try {
                                var idMk = stringIDToTypeID("make");
                                var desc2 = new ActionDescriptor();
                                var idNw = charIDToTypeID("Nw  ");
                                var idChnl = charIDToTypeID("Chnl");
                                desc2.putClass(idNw, idChnl);
                                var idAt = charIDToTypeID("At  ");
                                var ref2 = new ActionReference();
                                var idChnl = charIDToTypeID("Chnl");
                                var idMsk = charIDToTypeID("Msk ");
                                ref2.putEnumerated(idChnl, idChnl, idMsk);
                                desc2.putReference(idAt, ref2);
                                executeAction(idMk, desc2, DialogModes.NO);
                                
                                Logger.debug("  代替方法でレイヤーマスクを適用しました");
                                Logger.writeLog(logFile, "    代替方法でレイヤーマスクを適用しました");
                                // ターゲットレイヤーを非表示にする
                                targetLayer.visible = false;
                                Logger.writeLog(logFile, "    ターゲットレイヤーを非表示にしました");
                                processedCount++;
                            } catch(e2) {
                                Logger.debug("  すべてのマスク適用方法が失敗: " + e2);
                                Logger.writeLog(logFile, "    すべてのマスク適用方法が失敗: " + e2);
                                alert("レイヤー「" + targetLayer.name + "」へのマスク適用に失敗しました: " + e2);
                            }
                        }
                    }
                    
                    // 選択を解除
                    app.activeDocument.selection.deselect();
                    
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
            
            if (processedCount > 0) {
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
            } else {
                // ログに情報を書き込む
                Logger.writeLog(logFile, "  - マスクレイヤーが見つからないか、処理に失敗しました");
            }
            
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
