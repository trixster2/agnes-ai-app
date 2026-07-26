import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  textToImage, createVideo, pollVideo,
  SIZE_OPTIONS, RATIO_OPTIONS, SIZE_RATIO_PIXELS, DURATION_PRESETS,
} from './api';

const DEFAULT_KEY = 'sk-Ub0CZYPi03fDasvt6QtaNFghR9DfwXpOVct1yKiY0M0IhMzd';

function TabBar({ tab, setTab }) {
  const tabs = [
    { key: 'image', label: '文生图', emoji: '🖼' },
    { key: 'video', label: '视频', emoji: '🎬' },
    { key: 'settings', label: '设置', emoji: '⚙' },
  ];
  return (
    <View style={s.tabBar}>
      {tabs.map((t) => (
        <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
          <Text style={s.tabEmoji}>{t.emoji}</Text>
          <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ImageTab() {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('2K');
  const [ratio, setRatio] = useState('1:1');
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [apiKey, setApiKey] = useState('');

  React.useEffect(() => { AsyncStorage.getItem('api_key').then((k) => setApiKey(k || '')); }, []);

  const generate = async () => {
    if (!prompt.trim()) { Alert.alert('请输入提示词'); return; }
    setLoading(true); setImageUrl(null);
    try {
      const url = await textToImage(apiKey, prompt, size, ratio);
      setImageUrl(url);
    } catch (e) {
      Alert.alert('生成失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!imageUrl) return;
    const ext = imageUrl.split('.').pop().split('?')[0] || 'png';
    const dest = `${FileSystem.cacheDirectory}agnes_${Date.now()}.${ext}`;
    await FileSystem.downloadAsync(imageUrl, dest);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest);
    } else {
      Alert.alert('已保存', dest);
    }
  };

  const pixels = SIZE_RATIO_PIXELS[size]?.[ratio] || '';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>文生图</Text>
      <Text style={s.label}>提示词（英文效果最好）</Text>
      <TextInput style={s.input} value={prompt} onChangeText={setPrompt}
        placeholder="A Shiba Inu wearing sunglasses swimming in blue water..." placeholderTextColor="#666"
        multiline numberOfLines={4} />
      <View style={s.row}>
        <View style={s.half}>
          <Text style={s.label}>尺寸</Text>
          <View style={s.chipRow}>
            {SIZE_OPTIONS.map((sz) => (
              <TouchableOpacity key={sz} style={[s.chip, size === sz && s.chipOn]} onPress={() => setSize(sz)}>
                <Text style={[s.chipText, size === sz && s.chipTextOn]}>{sz}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.half}>
          <Text style={s.label}>比例</Text>
          <View style={s.chipRow}>
            {RATIO_OPTIONS.slice(0, 4).map((r) => (
              <TouchableOpacity key={r} style={[s.chip, ratio === r && s.chipOn]} onPress={() => setRatio(r)}>
                <Text style={[s.chipText, ratio === r && s.chipTextOn]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      <Text style={s.hint}>输出分辨率: {pixels}</Text>
      <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={generate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>生成图像</Text>}
      </TouchableOpacity>
      {imageUrl && (
        <View style={s.resultBox}>
          <Image source={{ uri: imageUrl }} style={s.resultImage} resizeMode="contain" />
          <TouchableOpacity style={s.downloadBtn} onPress={download}>
            <Text style={s.downloadText}>保存 / 分享</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function VideoTab() {
  const [prompt, setPrompt] = useState('');
  const [durationIdx, setDurationIdx] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const pollRef = useRef(null);

  React.useEffect(() => { AsyncStorage.getItem('api_key').then((k) => setApiKey(k || '')); }, []);
  React.useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const generate = async () => {
    if (!prompt.trim()) { Alert.alert('请输入提示词'); return; }
    setLoading(true); setStatus('创建任务中...'); setVideoUrl(null);
    try {
      const preset = DURATION_PRESETS[durationIdx];
      const { videoId } = await createVideo(apiKey, prompt, 1152, 768, preset.numFrames, preset.frameRate);
      setStatus('任务已创建, 每10秒自动查询进度...');
      pollRef.current = setInterval(async () => {
        try {
          const data = await pollVideo(apiKey, videoId);
          setStatus(`${data.status} (${data.progress || 0}%)`);
          if (data.status === 'completed') {
            clearInterval(pollRef.current);
            const url = data.url || data.metadata?.url;
            if (url) {
              setVideoUrl(url);
              setLoading(false);
            } else {
              setStatus('完成但未获取到视频地址');
              setLoading(false);
            }
          } else if (data.status === 'failed') {
            clearInterval(pollRef.current);
            setStatus('生成失败');
            setLoading(false);
          }
        } catch (e) {
          clearInterval(pollRef.current);
          setStatus('查询失败: ' + e.message);
          setLoading(false);
        }
      }, 10000);
    } catch (e) {
      setStatus('创建失败: ' + e.message);
      setLoading(false);
    }
  };

  const download = async () => {
    if (!videoUrl) return;
    const dest = `${FileSystem.cacheDirectory}agnes_video_${Date.now()}.mp4`;
    setStatus('下载中...');
    await FileSystem.downloadAsync(videoUrl, dest);
    setStatus('下载完成');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest);
    } else {
      Alert.alert('已保存', dest);
    }
  };

  const cancel = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setLoading(false); setStatus('已取消');
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>文生视频</Text>
      <Text style={s.label}>提示词（英文效果最好）</Text>
      <TextInput style={s.input} value={prompt} onChangeText={setPrompt}
        placeholder="Cinematic sunset beach waves, golden lighting..." placeholderTextColor="#666"
        multiline numberOfLines={3} />
      <Text style={s.label}>时长</Text>
      <View style={s.chipRow}>
        {DURATION_PRESETS.map((p, i) => (
          <TouchableOpacity key={i} style={[s.chip, durationIdx === i && s.chipOn]} onPress={() => setDurationIdx(i)}>
            <Text style={[s.chipText, durationIdx === i && s.chipTextOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.hint}>分辨率: 1152x768 (720p) | 可能被自动标准化</Text>
      <View style={s.row}>
        <TouchableOpacity style={[s.btn, s.btnFlex, loading && s.btnDisabled]} onPress={generate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>生成视频</Text>}
        </TouchableOpacity>
        {loading && (
          <TouchableOpacity style={[s.btn, s.btnFlex, s.btnCancel]} onPress={cancel}>
            <Text style={s.btnText}>取消</Text>
          </TouchableOpacity>
        )}
      </View>
      {status ? <Text style={s.status}>{status}</Text> : null}
      {videoUrl && (
        <TouchableOpacity style={s.downloadBtn} onPress={download}>
          <Text style={s.downloadText}>下载 / 分享视频</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  React.useEffect(() => { AsyncStorage.getItem('api_key').then((k) => setApiKey(k || DEFAULT_KEY)); }, []);

  const save = async () => {
    await AsyncStorage.setItem('api_key', apiKey.trim());
    Alert.alert('已保存', 'API Key 已更新');
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>设置</Text>
      <Text style={s.label}>API Key（已内置默认密钥）</Text>
      <TextInput style={[s.input, { minHeight: 50 }]} value={apiKey} onChangeText={setApiKey}
        placeholder="sk-..." placeholderTextColor="#666" autoCapitalize="none" />
      <TouchableOpacity style={s.btn} onPress={save}>
        <Text style={s.btnText}>保存</Text>
      </TouchableOpacity>
      <View style={s.about}>
        <Text style={s.aboutTitle}>Agnes AI 助手 v1.0</Text>
        <Text style={s.aboutText}>基于 Agnes Image 2.1 Flash + Agnes Video V2.0</Text>
        <Text style={s.aboutText}>所有生成内容均通过 API 调用，图片和视频缓存于本地</Text>
        <Text style={s.aboutText}>生成后可通过系统分享菜单保存至相册</Text>
      </View>
    </ScrollView>
  );
}

export default function App() {
  const [tab, setTab] = useState('image');
  return (
    <View style={s.root}>
      {tab === 'image' && <ImageTab />}
      {tab === 'video' && <VideoTab />}
      {tab === 'settings' && <SettingsTab />}
      <TabBar tab={tab} setTab={setTab} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d1a' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#aab', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#2a2a4a',
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
  },
  chipOn: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  chipText: { color: '#aab', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  hint: { color: '#667', fontSize: 12, marginTop: 8, marginBottom: 12 },
  btn: {
    backgroundColor: '#6c5ce7', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  btnFlex: { flex: 1 },
  btnCancel: { backgroundColor: '#e74c3c' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultBox: { marginTop: 20, alignItems: 'center' },
  resultImage: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#1a1a2e' },
  downloadBtn: {
    backgroundColor: '#2d2d4a', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 30, marginTop: 12,
  },
  downloadText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  status: { color: '#aab', fontSize: 14, marginTop: 16, textAlign: 'center', lineHeight: 22 },
  tabBar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1a1a2e',
    backgroundColor: '#0d0d1a', paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  tabActive: {},
  tabEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#667', marginTop: 2 },
  tabLabelActive: { color: '#6c5ce7', fontWeight: '700' },
  about: { marginTop: 40, padding: 20, backgroundColor: '#1a1a2e', borderRadius: 12 },
  aboutTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  aboutText: { color: '#889', fontSize: 13, lineHeight: 22 },
});
