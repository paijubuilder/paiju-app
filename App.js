import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ToastAndroid,
  Platform,
  ActivityIndicator,
  ProgressBarAndroid,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import AIChatModal from './components/AIChatModal';

// ==================== 配置区域 ====================
// 请替换为您实际部署的Vercel URL
const REMOTE_URL = 'https://your-paiju-spa.vercel.app';
const LOCAL_URL = 'file:///android_asset/web/index.html';
const VERSION_KEY = 'web_version';
const LOAD_TIMEOUT = 5000; // 5秒超时
// ================================================

const App = () => {
  // 状态管理
  const [webViewUrl, setWebViewUrl] = useState(LOCAL_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [showAIChat, setShowAIChat] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isRemoteMode, setIsRemoteMode] = useState(false);
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  
  const webViewRef = useRef(null);
  const loadTimeoutRef = useRef(null);

  // ==================== 初始化 ====================
  useEffect(() => {
    console.log('[App] 应用启动');
    initializeApp();
    return () => clearLoadTimeout();
  }, []);

  // 初始化应用：先加载本地，后台检查远程
  const initializeApp = async () => {
    try {
      // 1. 立即加载本地文件
      console.log('[App] 加载本地文件');
      setWebViewUrl(LOCAL_URL);
      setIsLoading(false);

      // 2. 后台检查网络连接
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        console.log('[App] 网络已连接，检查远程更新');
        checkRemoteUpdate();
      } else {
        console.log('[App] 无网络连接，使用本地模式');
      }
    } catch (error) {
      console.error('[App] 初始化失败:', error);
    }
  };

  // ==================== 远程版本检测 ====================
  const checkRemoteUpdate = async () => {
    try {
      console.log('[App] 检查远程版本...');
      
      // 获取本地存储的版本
      const localVersion = await AsyncStorage.getItem(VERSION_KEY);
      
      // 尝试获取远程version.json
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      try {
        const response = await fetch(`${REMOTE_URL}/version.json`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const remoteData = await response.json();
          const remoteVersion = remoteData.version || remoteData.timestamp || Date.now().toString();
          
          console.log('[App] 本地版本:', localVersion || '无');
          console.log('[App] 远程版本:', remoteVersion);
          
          if (localVersion !== remoteVersion) {
            console.log('[App] 检测到新版本，切换到远程模式');
            await AsyncStorage.setItem(VERSION_KEY, remoteVersion);
            switchToRemote();
          } else {
            console.log('[App] 已是最新版本，继续使用本地模式');
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.log('[App] 远程版本检查超时或失败:', fetchError.message);
      }
    } catch (error) {
      console.log('[App] 版本检查异常:', error.message);
    }
  };

  // ==================== 切换到远程模式 ====================
  const switchToRemote = () => {
    console.log('[App] 切换到远程模式');
    setIsRemoteMode(true);
    setRemoteAvailable(true);
    setWebViewUrl(REMOTE_URL);
    setLoadError(false);
    setIsLoading(true);
    startLoadTimeout();
  };

  // ==================== 超时控制 ====================
  const startLoadTimeout = () => {
    clearLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      console.log('[App] 加载超时');
      handleTimeout();
    }, LOAD_TIMEOUT);
  };

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const handleTimeout = () => {
    if (isRemoteMode) {
      console.log('[App] 远程加载超时，降级到本地');
      setIsRemoteMode(false);
      setRemoteAvailable(false);
      setWebViewUrl(LOCAL_URL);
      setIsLoading(false);
      ToastAndroid.show('网络响应慢，已切换到离线模式', ToastAndroid.LONG);
    } else {
      setIsLoading(false);
      setLoadError(true);
    }
  };

  // ==================== WebView事件处理 ====================
  const handleLoadStart = () => {
    console.log('[App] WebView开始加载');
    setIsLoading(true);
    setLoadError(false);
    setProgress(0);
    startLoadTimeout();
  };

  const handleLoadProgress = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    setProgress(nativeEvent.progress);
  };

  const handleLoadEnd = () => {
    clearLoadTimeout();
    setIsLoading(false);
    setProgress(1);
    console.log('[App] WebView加载完成, URL:', webViewUrl);
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[App] WebView加载错误:', nativeEvent);
    
    clearLoadTimeout();
    setIsLoading(false);
    
    if (isRemoteMode) {
      console.log('[App] 远程加载失败，降级到本地');
      setIsRemoteMode(false);
      setRemoteAvailable(false);
      setWebViewUrl(LOCAL_URL);
      ToastAndroid.show('网络连接失败，已切换到离线模式', ToastAndroid.LONG);
    } else {
      setLoadError(true);
      ToastAndroid.show('页面加载失败，请重启应用', ToastAndroid.LONG);
    }
  };

  const handleHttpError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[App] HTTP错误:', nativeEvent.statusCode, nativeEvent.url);
    
    // 4xx/5xx错误时降级到本地
    if (nativeEvent.statusCode >= 400 && isRemoteMode) {
      console.log('[App] HTTP错误，降级到本地');
      setIsRemoteMode(false);
      setRemoteAvailable(false);
      setWebViewUrl(LOCAL_URL);
      ToastAndroid.show('服务器错误，已切换到离线模式', ToastAndroid.LONG);
    }
  };

  const handleShouldStartLoadWithRequest = (request) => {
    const { url } = request;
    
    // 允许file://协议（本地资源）
    if (url.startsWith('file://')) return true;
    
    // 允许http/https协议
    if (url.startsWith('http://') || url.startsWith('https://')) return true;
    
    // 阻止其他协议
    return false;
  };

  // ==================== 重试和切换 ====================
  const handleRetry = () => {
    console.log('[App] 用户点击重试');
    setLoadError(false);
    setIsLoading(true);
    setWebViewUrl(LOCAL_URL);
    setIsRemoteMode(false);
    setRemoteAvailable(false);
  };

  const handleSwitchToRemote = () => {
    console.log('[App] 用户手动切换到远程模式');
    switchToRemote();
  };

  // ==================== WebView消息处理 ====================
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[App] 收到WebView消息:', data);

      switch (data.type) {
        case 'REQUEST_RISK_DATA':
          sendRiskDataToWebView();
          break;
        case 'OPEN_AI_CHAT':
          setShowAIChat(true);
          break;
        case 'HEARTBEAT':
          // 心跳响应，无需处理
          break;
        default:
          console.log('[App] 未知消息类型:', data.type);
      }
    } catch (error) {
      console.log('[App] 解析消息失败:', error);
    }
  };

  const sendRiskDataToWebView = () => {
    const riskData = {
      score: 98,
      level: '低',
      rooted: false,
      xposed: false,
      vpn: false,
      devOptions: false,
      timestamp: Date.now(),
    };

    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.onRiskDataUpdated) {
          window.onRiskDataUpdated(${JSON.stringify(riskData)});
        }
        true;
      `);
    }
  };

  // ==================== 注入JavaScript ====================
  const injectedJavaScript = `
    // 隐藏滚动条
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.webkitTapHighlightColor = 'transparent';

    // 确保postMessage可用
    window.ReactNativeWebView = window.ReactNativeWebView || {};
    window.ReactNativeWebView.postMessage = function(data) {
      window.postMessage(data, '*');
    };

    // 风险数据回调占位
    window.onRiskDataUpdated = function(data) {
      console.log('[WebView] 风险数据更新:', data);
    };

    // 心跳
    setInterval(function() {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HEARTBEAT',
          timestamp: Date.now()
        }));
      }
    }, 30000);

    true;
  `;

  // ==================== 渲染 ====================
  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>页面加载失败</Text>
        <Text style={styles.errorText}>请检查应用文件是否完整</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>重新加载</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={styles.webview}
        // 缓存配置
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        domStorageEnabled={true}
        javaScriptEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowFileAccess={true}
        mixedContentMode="always"
        // 硬件加速
        androidHardwareAccelerationDisabled={false}
        // 渲染优化
        renderToHardwareTextureAndroid={true}
        overScrollMode="never"
        // 事件处理
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onLoadProgress={handleLoadProgress}
        onError={handleError}
        onHttpError={handleHttpError}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        startInLoadingState={true}
        setSupportMultipleWindows={false}
        scalesPageToFit={Platform.OS === 'android'}
      />

      {/* 加载进度条 */}
      {isLoading && progress > 0 && progress < 1 && (
        <View style={styles.progressBarContainer}>
          <ProgressBarAndroid
            styleAttr="Horizontal"
            indeterminate={false}
            progress={progress}
            color="#007AFF"
          />
        </View>
      )}

      {/* 加载指示器 */}
      {isLoading && progress === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      {/* 模式指示器（开发调试用） */}
      {__DEV__ && (
        <View style={styles.modeIndicator}>
          <Text style={styles.modeText}>
            {isRemoteMode ? 'REMOTE' : 'LOCAL'}
          </Text>
        </View>
      )}

      {/* AI助手浮动按钮 */}
      <TouchableOpacity
        style={styles.aiButton}
        onPress={() => setShowAIChat(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.aiButtonText}>AI助手</Text>
      </TouchableOpacity>

      {/* AI聊天模态框 */}
      <AIChatModal visible={showAIChat} onClose={() => setShowAIChat(false)} />
    </View>
  );
};

// ==================== 样式 ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  modeIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 200,
  },
  modeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  aiButton: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default App;
