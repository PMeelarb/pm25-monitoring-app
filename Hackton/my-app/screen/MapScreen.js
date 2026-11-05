import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Dimensions,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
  Animated, PanResponder
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // 🌟 ดึงไอคอนมาใช้สำหรับปุ่ม GPS

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = '@air_favorites_v3';
const POLLUTANT_TABS = ['PM2.5', 'AQI', 'PM10', 'O3', 'NO2'];
const COLOR_LEGEND = [
  { label: 'ดี 0–25',          color: '#4CAF50' },
  { label: 'ปานกลาง 26–37',    color: '#FDD835' },
  { label: 'ปานกลาง 38–50',    color: '#FB8C00' },
  { label: 'เริ่มมีผล 51–90',  color: '#E53935' },
  { label: 'มีผลกระทบ 91+',    color: '#8E24AA' },
];

// 🟢 4 จังหวัด Default สำหรับ Shortcut
const DEFAULT_SHORTCUTS = [
  { id: 'def-korat', nickname: 'นครราชสีมา', lat: 14.9799, lon: 102.0978, isDefault: true },
  { id: 'def-buriram', nickname: 'บุรีรัมย์', lat: 14.9930, lon: 103.1029, isDefault: true },
  { id: 'def-surin', nickname: 'สุรินทร์', lat: 14.8818, lon: 103.4936, isDefault: true },
  { id: 'def-chaiyaphum', nickname: 'ชัยภูมิ', lat: 15.8105, lon: 102.0286, isDefault: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeNum = (v) => {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  const n = parseFloat(v); return isFinite(n) ? n : null;
};
const getPMColor = (v) => {
  if (v === null) return '#BDBDBD';
  if (v <= 25) return '#4CAF50'; if (v <= 37) return '#FDD835';
  if (v <= 50) return '#FB8C00'; if (v <= 90) return '#E53935';
  return '#8E24AA';
};
const getPMTextColor = (v) => (v !== null && v > 25 && v <= 50) ? '#333' : '#fff';
const getPMStatus = (v) => {
  if (v === null) return 'ไม่มีข้อมูล';
  if (v <= 25) return 'ดี';
  if (v <= 50) return 'ปานกลาง';
  if (v <= 90) return 'เริ่มมีผลกระทบ';
  return 'มีผลกระทบต่อสุขภาพ';
};
// ─── ฟังก์ชันคำอธิบายมลพิษแต่ละชนิด ──────────────────────────────────────────
const getPollutantInfo = (tab) => {
  switch (tab) {
    case 'AQI': 
      return 'ดัชนีคุณภาพอากาศ (Air Quality Index) คือตัวเลขที่ใช้วัดคุณภาพอากาศในภาพรวม ยิ่งค่าสูงแสดงว่ามีมลพิษทางอากาศหนาแน่น ซึ่งอาจทำให้เกิดอาการระคายเคืองตา แสบคอ หายใจลำบาก และส่งผลเสียต่อระบบทางเดินหายใจในระยะยาว';
    case 'PM2.5': 
      return 'ฝุ่นละอองขนาดเล็กมาก (ไม่เกิน 2.5 ไมครอน) สามารถเล็ดลอดผ่านเยื่อบุจมูกเข้าสู่ปอดและกระแสเลือดได้โดยตรง เป็นสาเหตุของโรคหอบหืด ภูมิแพ้ และโรคหัวใจ';
    case 'PM10': 
      return 'ฝุ่นละอองขนาดเล็ก (ไม่เกิน 10 ไมครอน) ส่วนใหญ่มาจากฝุ่นดิน ทราย หรือการก่อสร้าง สามารถเข้าไปสะสมในระบบทางเดินหายใจส่วนต้น ก่อให้เกิดอาการไอ จาม หรือระคายเคืองได้';
    case 'O3': 
      return 'โอโซนระดับพื้นดิน เกิดจากไอเสียรถยนต์หรือโรงงานทำปฏิกิริยากับแสงแดด หากสูดดมเข้าไปจะทำให้แสบตา แสบจมูก และลดประสิทธิภาพการทำงานของปอด';
    case 'NO2': 
      return 'ก๊าซไนโตรเจนไดออกไซด์ มักเกิดจากการเผาไหม้ของเครื่องยนต์ ลดความต้านทานของร่างกายต่อการติดเชื้อในระบบทางเดินหายใจ';
    default: 
      return '';
  }
};
const getHealthAdvice = (v) => {
  if (v === null) return 'ไม่มีข้อมูลเพียงพอสำหรับประเมินคำแนะนำ';
  if (v <= 25) return 'อากาศดีมาก 🌿 เหมาะกับการออกกำลังกายและทำกิจกรรมกลางแจ้งได้อย่างเต็มที่';
  if (v <= 37) return 'คุณภาพอากาศปานกลาง 🌤️ สามารถใช้ชีวิตประจำวันและทำกิจกรรมกลางแจ้งได้ตามปกติ';
  if (v <= 50) return 'ฝุ่นเริ่มมีปริมาณมากขึ้น 😷 ผู้ที่แพ้อากาศหรือมีโรคประจำตัว ควรลดระยะเวลาทำกิจกรรมกลางแจ้ง';
  if (v <= 90) return 'สภาพอากาศเริ่มมีผลกระทบ! ⚠️ ควรสวมหน้ากากอนามัย (PM2.5) หากต้องออกนอกอาคาร และงดออกกำลังกายกลางแจ้ง';
  return 'อันตรายต่อสุขภาพ! 🚫☣️ ควรงดออกจากบ้านหากไม่จำเป็น หากจำเป็นต้องออก ควรสวมหน้ากาก N95 ป้องกันเสมอ';
};

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const isTargetProvince = (text) => {
  if (!text) return false;
  const t = text.toLowerCase();
  return ['นครราชสีมา','nakhon ratchasima','korat','บุรีรัมย์','buri ram','buriram','สุรินทร์','surin','ชัยภูมิ','chaiyaphum'].some(k => t.includes(k));
};
const getProvinceNameTH = (text) => {
  if (!text) return 'ไม่ระบุ';
  if (text.includes('นครราชสีมา') || text.toLowerCase().includes('nakhon')) return 'นครราชสีมา';
  if (text.includes('บุรีรัมย์')  || text.toLowerCase().includes('buri'))   return 'บุรีรัมย์';
  if (text.includes('สุรินทร์')   || text.toLowerCase().includes('surin'))  return 'สุรินทร์';
  if (text.includes('ชัยภูมิ')    || text.toLowerCase().includes('chaiya')) return 'ชัยภูมิ';
  return text;
};

const cleanThaiAddress = (address) => {
  if (!address) return '';
  let cleaned = address.trim();
  cleaned = cleaned.replace(/^ถ\./g, 'ถนน').replace(/ ถ\./g, ' ถนน');
  cleaned = cleaned.replace(/^ซ\./g, 'ซอย').replace(/ ซ\./g, ' ซอย');
  cleaned = cleaned.replace(/^ต\./g, 'ตำบล').replace(/ ต\./g, ' ตำบล');
  cleaned = cleaned.replace(/^อ\./g, 'อำเภอ').replace(/ อ\./g, ' อำเภอ');
  cleaned = cleaned.replace(/^จ\./g, 'จังหวัด').replace(/ จ\./g, ' จังหวัด');
  return cleaned;
};

const getMockBadStations = () => {
  return [
    { id: 'mock-bad-1', stationID: 'mock-1', name: '🏭 เขตอุตสาหกรรม (จุดจำลอง)', province: 'นครราชสีมา', network: 'Mock Data', lat: 14.95, lon: 102.1, pm25: 145.5, aqi: 210, pm10: 180, o3: 45, no2: 25 },
    { id: 'mock-bad-2', stationID: 'mock-2', name: '🔥 พื้นที่เผาป่า (จุดจำลอง)', province: 'บุรีรัมย์', network: 'Mock Data', lat: 14.99, lon: 103.1, pm25: 215.0, aqi: 285, pm10: 250, o3: 30, no2: 15 }
  ];
};

const geocodeAddress = async (address) => {
  if (!address) return null;
  const cleanAddress = cleanThaiAddress(address);

  try {
    const expoResult = await Location.geocodeAsync(cleanAddress);
    if (expoResult && expoResult.length > 0) {
      const { latitude, longitude } = expoResult[0];
      const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
      let displayName = cleanAddress;
      if (reverse && reverse.length > 0) {
         const r = reverse[0];
         displayName = [r.name, r.district, r.subregion, r.region]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ');
      }
      return { lat: latitude, lon: longitude, displayName };
    }
  } catch (e) {
    console.log('Expo geocode failed, falling back to OSM');
  }

  try {
    const query = encodeURIComponent(cleanAddress + ' ประเทศไทย');
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=th&viewbox=101.1,16.5,104.5,14.0&bounded=0`;
    const res = await fetch(url, { headers: { 'User-Agent': 'AirQualityApp/2.0' } });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), displayName: data[0].display_name };
    }
    return null;
  } catch { 
    return null; 
  }
};

// ─── SparkChart ───────────────────────────────────────────────────────────────
function SparkChart({ data, color }) {
  if (!data || data.length < 2) return null;
  const W = SCREEN_WIDTH - 80, H = 60, pad = 4;
  const vals = data.map(d => d.value).filter(v => v !== null);
  if (vals.length < 2) return null;
  const maxV = Math.max(...vals, 1), minV = Math.min(...vals, 0), range = maxV - minV || 1;
  const pts = data.map((d, i) =>
    `${pad + (i / (data.length - 1)) * (W - pad * 2)},${H - pad - ((d.value - minV) / range) * (H - pad * 2)}`
  ).join(' ');
  const labelIdxs = [0, Math.floor(data.length / 2), data.length - 1];
  const lx = pad + ((data.length - 1) / (data.length - 1)) * (W - pad * 2);
  const ly = H - pad - ((data[data.length - 1].value - minV) / range) * (H - pad * 2);
  return (
    <Svg width={W} height={H + 16}>
      <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#eee" strokeWidth={1} />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={lx} cy={ly} r={4} fill={color} />
      {labelIdxs.map(i => (
        <SvgText key={i} x={pad + (i / (data.length - 1)) * (W - pad * 2)} y={H + 12}
          fontSize={9} fill="#aaa" textAnchor="middle">{data[i].label}</SvgText>
      ))}
    </Svg>
  );
}

// ─── AddFavoriteModal ─────────────────────────────────────────────────────────
function AddFavoriteModal({ visible, stationName, province, onConfirm, onCancel }) {
  const [nickname, setNickname] = useState('');
  useEffect(() => { if (visible) setNickname(stationName || ''); }, [visible, stationName]);
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <Text style={mStyles.title}>★ ติดดาวสถานีนี้</Text>
          <Text style={mStyles.sub}>{stationName}</Text>
          <Text style={mStyles.sub2}>{province}</Text>
          <Text style={mStyles.label}>ตั้งชื่อเรียก เช่น "บ้านยาย 👵", "ที่ทำงาน 🏢"</Text>
          <TextInput
            style={mStyles.input} value={nickname} onChangeText={setNickname}
            placeholder="ชื่อที่จำง่าย…" placeholderTextColor="#BCAAA4"
            maxLength={30} autoFocus
          />
          <View style={mStyles.btnRow}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onCancel}>
              <Text style={mStyles.cancelText}>ยกเลิก</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.confirmBtn, !nickname.trim() && { opacity: 0.5 }]}
              onPress={() => nickname.trim() && onConfirm(nickname.trim())}
              disabled={!nickname.trim()}
            >
              <Text style={mStyles.confirmText}>★ ติดดาว</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── AddressSearchModal ───────────────────────────────────────────────────────
function AddressSearchModal({ visible, onFound, onCancel }) {
  const [query, setQuery]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError('');
    const result = await geocodeAddress(query.trim());
    setLoading(false);
    if (!result) { setError('ไม่พบที่อยู่นี้ ลองพิมพ์ชื่อสถานที่, ตำบล หรืออำเภอใหม่อีกครั้ง'); return; }
    onFound(result); setQuery('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <Text style={mStyles.title}>📍 ค้นหาและเพิ่มที่อยู่</Text>
          <Text style={[mStyles.label, { color: '#1565C0', fontWeight: '600', marginBottom: 2 }]}>
            รูปแบบที่แนะนำ:
          </Text>
          <Text style={[mStyles.label, { marginBottom: 10, lineHeight: 20 }]}>
            บ้านเลขที่, ถนน (หรือ ถ.), ต.ตำบล อ.อำเภอ จ.จังหวัด รหัสไปรษณีย์{'\n'}
            <Text style={{ fontSize: 11, color: '#888' }}>* ใส่ข้อมูลชื่อถนน หรือตัวย่อ ถ. เพื่อให้ระบบค้นหาตำแหน่งได้แม่นยำมากขึ้น</Text>
          </Text>

          <TextInput
            style={mStyles.input} value={query} onChangeText={t => { setQuery(t); setError(''); }}
            placeholder="เช่น ถ.มหาวิทยาลัย ต.สุรนารี อ.เมือง..."
            placeholderTextColor="#BCAAA4" autoFocus returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {error ? <Text style={mStyles.errorText}>{error}</Text> : null}
          <View style={mStyles.btnRow}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={() => { setQuery(''); setError(''); onCancel(); }}>
              <Text style={mStyles.cancelText}>ยกเลิก</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.confirmBtn, (!query.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleSearch} disabled={!query.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={mStyles.confirmText}>🔍 ค้นหา</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── FavoritesStrip (เหลือเฉพาะดาว) ──────────────────────────────────────────
function FavoritesStrip({ favorites, stationsData, activeTab, onSelect, selectedKey, onRemoveFav }) {
  const getVal = (s, tab) => {
    if (!s) return null;
    switch (tab) { case 'AQI': return s.aqi; case 'PM10': return s.pm10; case 'O3': return s.o3; case 'NO2': return s.no2; default: return s.pm25; }
  };
  const favList = Object.values(favorites);
  
  if (favList.length === 0) return (
    <View style={fStyles.emptyWrap}><Text style={fStyles.emptyText}>กด ☆ บนสถานี เพื่อเพิ่มรายการโปรด</Text></View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fStyles.row}>
      {favList.map(fav => {
        const s = stationsData.find(x => x.id === fav.stationId);
        const val = getVal(s, activeTab);
        const color = getPMColor(val);
        const isActive = selectedKey === `fav-${fav.stationId}`;
        return (
          <TouchableOpacity key={`fav-${fav.stationId}`}
            style={[fStyles.chip, isActive && fStyles.chipActive]}
            onPress={() => s && onSelect(s)}
            onLongPress={() => Alert.alert('ลบออกจากติดดาว?', fav.nickname, [
              { text: 'ยกเลิก', style: 'cancel' },
              { text: 'ลบออก', style: 'destructive', onPress: () => onRemoveFav(fav.stationId) },
            ])}
          >
            <View style={[fStyles.dot, { backgroundColor: color }]} />
            <View>
              <Text style={fStyles.name} numberOfLines={1}>{fav.nickname}</Text>
              <Text style={[fStyles.val, { color: val !== null ? color : '#bbb' }]}>{val !== null ? `${val} µg/m³` : 'N/A'}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MapScreen() {
  const [location,          setLocation]          = useState(null);
  const [myLocationStation,  setMyLocationStation]  = useState(null); 
  const [selectedStation,    setSelectedStation]    = useState(null);
  const [stationsData,       setStationsData]       = useState([]);
  const [isLoading,          setIsLoading]          = useState(true);
  const [activeTab,          setActiveTab]          = useState('PM2.5');
  const [historyData,        setHistoryData]        = useState([]);
  const [weather,            setWeather]            = useState(null);
  const [historyLoading,     setHistoryLoading]     = useState(false);

  const [favorites,          setFavorites]          = useState({});
  const [customPins,         setCustomPins]         = useState({});
  const [selectedKey,        setSelectedKey]        = useState(null);
  const [selectedPin,        setSelectedPin]        = useState(null);
  const [nearestForPin,      setNearestForPin]      = useState(null);

  const [showAddFavModal,    setShowAddFavModal]    = useState(false);
  const [showAddressModal,   setShowAddressModal]   = useState(false);

  const mapRef = useRef(null);

  // ─── Bottom Sheet Animation Setup ───────────────────────────────────────────
  const MAX_PANEL_HEIGHT = SCREEN_HEIGHT * 0.60;
  const MIN_PANEL_HEIGHT = 160; 
  
  const panelY = useRef(new Animated.Value(MAX_PANEL_HEIGHT - MIN_PANEL_HEIGHT)).current;
  const isPanelOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) openPanel();
        else if (gestureState.dy > 50) closePanel();
        else isPanelOpen.current ? openPanel() : closePanel();
      },
    })
  ).current;

  const openPanel = () => {
    isPanelOpen.current = true;
    Animated.spring(panelY, { toValue: 0, useNativeDriver: false, bounciness: 8 }).start();
  };

  const closePanel = () => {
    isPanelOpen.current = false;
    Animated.spring(panelY, { toValue: MAX_PANEL_HEIGHT - MIN_PANEL_HEIGHT, useNativeDriver: false, bounciness: 8 }).start();
  };

  const togglePanel = () => { isPanelOpen.current ? closePanel() : openPanel(); };

  // ─── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.favorites)  setFavorites(parsed.favorites);
        if (parsed.customPins) setCustomPins(parsed.customPins);
      } catch {}
    });
  }, []);

  const persist = useCallback(async (newFavs, newPins) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ favorites: newFavs, customPins: newPins }));
  }, []);

  const addFavorite = useCallback((station, nickname) => {
    const n = { ...favorites, [station.id]: { stationId: station.id, nickname } };
    setFavorites(n); persist(n, customPins);
  }, [favorites, customPins, persist]);

  const removeFavorite = useCallback((stationId) => {
    const n = { ...favorites }; delete n[stationId];
    setFavorites(n); persist(n, customPins);
  }, [favorites, customPins, persist]);

  const addCustomPin = useCallback((geo, nickname) => {
    const id  = `pin_${Date.now()}`;
    const pin = { id, lat: geo.lat, lon: geo.lon, nickname, displayName: geo.displayName };
    const n   = { ...customPins, [id]: pin };
    setCustomPins(n); persist(favorites, n);
    return pin;
  }, [customPins, favorites, persist]);

  const removeCustomPin = useCallback((pinId) => {
    const n = { ...customPins }; delete n[pinId];
    setCustomPins(n); persist(favorites, n);
    if (selectedPin?.id === pinId) { setSelectedPin(null); setNearestForPin(null); setSelectedKey(null); }
  }, [customPins, favorites, persist, selectedPin]);

  const getPollutantValue = (s, tab) => {
    if (!s) return null;
    switch (tab) { case 'AQI': return s.aqi; case 'PM10': return s.pm10; case 'O3': return s.o3; case 'NO2': return s.no2; default: return s.pm25; }
  };

  const findNearest = useCallback((lat, lon) => {
    if (!stationsData.length) return null;
    // 🌟 กรองเอาแต่สถานีของจริงมาคำนวณหาระยะที่ใกล้ที่สุด
    const realStations = stationsData.filter(s => s.network !== 'Mock Data');
    if (realStations.length === 0) return null;
    return realStations.reduce((a, b) =>
      getDistanceKm(lat, lon, a.lat, a.lon) < getDistanceKm(lat, lon, b.lat, b.lon) ? a : b
    );
  }, [stationsData]);

  // ─── Fetch Data (Air4Thai & CMU) ─────────────────────────────────────────────
  // ─── Fetch Data (Air4Thai & CMU) ─────────────────────────────────────────────
  const fetchAir4Thai = async () => {
    try {
      const res  = await fetch('http://air4thai.com/forweb/getAQI_JSON.php');
      const data = await res.json();
      return data.stations
        .filter(s => isTargetProvince(s.areaTH) || isTargetProvince(s.nameTH) || isTargetProvince(s.nameEN))
        .map(s => {
          const aq   = s.AQILast ?? {};
          const pick = (u, l) => safeNum(aq[u]?.value) ?? safeNum(aq[l]?.value) ?? null;
          
          // 🌟 แก้ไข: ดึงค่า AQI ให้ตรงกับโครงสร้างเฉพาะของ Air4Thai
          let aqiVal = null;
          if (aq.AQI) {
            // Air4Thai มักเก็บ AQI ไว้ในตัวแปร .aqi ไม่ใช่ .value
            aqiVal = safeNum(aq.AQI.aqi) ?? safeNum(aq.AQI.AQI) ?? safeNum(aq.AQI.value) ?? null;
          }

          return { 
            id: `a4t-${s.stationID}`, 
            stationID: s.stationID, 
            name: s.nameTH, 
            province: getProvinceNameTH(s.areaTH), 
            network: 'Air4Thai', 
            lat: parseFloat(s.lat), 
            lon: parseFloat(s.long), 
            pm25: pick('PM25','pm25'), 
            aqi: aqiVal, // 🌟 ใช้ค่า AQI ที่ดึงมาใหม่
            pm10: pick('PM10','pm10'), 
            o3: pick('O3','o3'), 
            no2: pick('NO2','no2') 
          };
        }).filter(s => s.pm25 !== null || s.aqi !== null);
    } catch { return []; }
  };

  const fetchCMUCCDC = async () => {
    try {
      const res  = await fetch('https://www.cmuccdc.org/api/ccdc/stations');
      const data = await res.json();
      return data
        .filter(s => isTargetProvince(s.station_province) || isTargetProvince(s.station_name_th))
        .map(s => {
          const tryNum = (...ks) => { for (const k of ks) { const v = safeNum(s[k]); if (v !== null) return v; } return null; };
          return { 
            id: `cmu-${s.station_id}`, 
            stationID: s.station_id, 
            name: s.station_name_th || s.station_name_en, 
            province: getProvinceNameTH(s.station_province), 
            network: 'CMU CCDC', 
            lat: parseFloat(s.station_lat), 
            lon: parseFloat(s.station_lon), 
            pm25: tryNum('pm25','PM25','pm2_5'), 
            aqi: tryNum('aqi','AQI', 'th_aqi', 'us_aqi'), // 🌟 ดักชื่อตัวแปร AQI เผื่อไว้หลายรูปแบบ
            pm10: tryNum('pm10','PM10'), 
            o3: tryNum('o3','O3','ozone'), 
            no2: tryNum('no2','NO2') 
          };
        }).filter(s => s.pm25 !== null);
    } catch { return []; }
  };
  const generateMockHistory = (station) => {
    const now = new Date(), base = getPollutantValue(station, activeTab) ?? 30;
    return Array.from({ length: 9 }, (_, i) => {
      const h = new Date(now - (8 - i) * 3600000);
      return { label: `${String(h.getHours()).padStart(2,'0')}:00`, value: Math.max(0, base + Math.round((Math.random() - 0.5) * base * 0.4)) };
    });
  };

  const fetchHistory = async (station) => {
    if (!station) return;
    setHistoryLoading(true);
    if (station.network !== 'Air4Thai') { setHistoryData(generateMockHistory(station)); setHistoryLoading(false); return; }
    try {
      const pmap = { 'PM2.5': 'PM25', AQI: 'AQI', PM10: 'PM10', O3: 'O3', NO2: 'NO2' };
      const res  = await fetch(`http://air4thai.com/forweb/getHistoryData.php?stationID=${station.stationID}&param=${pmap[activeTab] || 'PM25'}&type=hr`);
      const text = await res.text();
      let parsed = null; try { parsed = JSON.parse(text); } catch {}
      if (parsed?.stations?.[0]?.data?.length > 0) {
        const mapped = parsed.stations[0].data.slice(-24)
          .map(d => ({ label: d.time ? d.time.substring(11, 16) : '', value: safeNum(d.value) ?? 0 }))
          .filter(d => d.value > 0);
        setHistoryData(mapped.length > 1 ? mapped : generateMockHistory(station));
      } else setHistoryData(generateMockHistory(station));
    } catch { setHistoryData(generateMockHistory(station)); }
    finally { setHistoryLoading(false); }
  };

  const fetchWeather = async (lat, lon) => {
    try {
      const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&forecast_days=1&timezone=Asia%2FBangkok`);
      const data = await res.json();
      const hour = new Date().getHours();
      setWeather({ temp: data.current_weather?.temperature ?? '--', humidity: data.hourly?.relativehumidity_2m?.[hour] ?? '--', wind: data.current_weather?.windspeed ?? '--' });
    } catch {}
  };

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [a, b]   = await Promise.all([fetchAir4Thai(), fetchCMUCCDC()]);
      const mockBad  = getMockBadStations();
      
      const combined = [...a, ...b, ...mockBad];
      setStationsData(combined);

      const { status } = await Location.requestForegroundPermissionsAsync();
      let closest = combined[0] ?? null;

      if (status === 'granted' && combined.length > 0) {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);

        // 🌟 แก้ไข: กรองเอาเฉพาะสถานีของจริง ไม่เอา Mock Data มาคำนวณจุดของฉัน
        const realStations = combined.filter(s => s.network !== 'Mock Data');
        let closestReal = realStations[0] ?? null;

        if (realStations.length > 0) {
          let minD = Infinity;
          for (const s of realStations) {
            const d = getDistanceKm(loc.coords.latitude, loc.coords.longitude, s.lat, s.lon);
            if (d < minD) { minD = d; closestReal = s; }
          }
        }
        setMyLocationStation(closestReal);
        closest = closestReal || closest; // ใช้เป็นค่า Default ตอนเข้าแอป
      }

      if (closest) { setSelectedStation(closest); fetchWeather(closest.lat, closest.lon); }
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (selectedStation) { fetchHistory(selectedStation); fetchWeather(selectedStation.lat, selectedStation.lon); }
  }, [selectedStation, activeTab]);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectStation = (station) => {
    setSelectedStation(station);
    setSelectedPin(null);
    setNearestForPin(null);
    setSelectedKey(`fav-${station.id}`);
    openPanel(); 
    mapRef.current?.animateToRegion({ latitude: station.lat, longitude: station.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
  };

  // 🌟 ฟังก์ชันจัดการเมื่อกดปุ่ม "ตำแหน่งของฉัน" (กลับไปยังจุดเริ่มต้น)
  const handleMyLocationPress = () => {
    if (!location) return;
    
    // วิ่งกล้องกลับมาที่พิกัดปัจจุบัน
    mapRef.current?.animateToRegion({ 
      latitude: location.latitude, 
      longitude: location.longitude, 
      latitudeDelta: 0.02, 
      longitudeDelta: 0.02 
    }, 800);

    // เซ็ตให้ Card ด้านล่างแสดงข้อมูลสถานีใกล้ตัว
    if (myLocationStation) {
      setSelectedStation(myLocationStation);
      setSelectedPin(null);
      setNearestForPin(null);
      setSelectedKey('my-location');
      openPanel(); 
      fetchWeather(myLocationStation.lat, myLocationStation.lon);
    }
  };

  const handleGeoFound = (geo) => {
    setShowAddressModal(false);
    const defaultName = geo.displayName.split(',')[0] || 'ตำแหน่งที่ค้นหา';
    const pin = addCustomPin(geo, defaultName);
    const nearest = findNearest(pin.lat, pin.lon);
    
    setSelectedPin(pin);
    setNearestForPin(nearest);
    setSelectedKey(`pin-${pin.id}`);
    setSelectedStation(null);
    
    openPanel(); 
    mapRef.current?.animateToRegion({ latitude: pin.lat, longitude: pin.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
    
    if (nearest) fetchWeather(nearest.lat, nearest.lon);
  };

  const handleSelectPin = (pin, nearest) => {
    setSelectedPin(pin);
    setNearestForPin(nearest);
    setSelectedKey(`pin-${pin.id}`);
    setSelectedStation(null);
    openPanel(); 
    mapRef.current?.animateToRegion({ latitude: pin.lat, longitude: pin.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
    if (nearest) fetchWeather(nearest.lat, nearest.lon);
  };

  const handleShortcutPress = (item) => {
    if (item.isDefault) {
      const realStations = stationsData.filter(s => s.network !== 'Mock Data');
      const nearestReal = realStations.length > 0 
        ? realStations.reduce((a, b) => getDistanceKm(item.lat, item.lon, a.lat, a.lon) < getDistanceKm(item.lat, item.lon, b.lat, b.lon) ? a : b)
        : null;

      if (nearestReal) {
        setSelectedStation(nearestReal);
        setSelectedPin(null);
        setNearestForPin(null);
        setSelectedKey(null);
        openPanel();
        mapRef.current?.animateToRegion({ 
          latitude: nearestReal.lat, 
          longitude: nearestReal.lon, 
          latitudeDelta: 0.05, 
          longitudeDelta: 0.05 
        }, 600);
      } else {
        mapRef.current?.animateToRegion({ 
          latitude: item.lat, 
          longitude: item.lon, 
          latitudeDelta: 0.5, 
          longitudeDelta: 0.5 
        }, 600);
      }
    } else {
      const nearest = findNearest(item.lat, item.lon);
      handleSelectPin(item, nearest);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const isFav          = selectedStation ? !!favorites[selectedStation.id] : false;
  const activeStation  = selectedPin ? nearestForPin : selectedStation;
  const activeValue    = getPollutantValue(activeStation, activeTab);
  const activeColor    = getPMColor(activeValue);
  const isMyLocSelected = selectedKey === 'my-location';
  const myDistKm = location && myLocationStation
    ? Math.round(getDistanceKm(location.latitude, location.longitude, myLocationStation.lat, myLocationStation.lon))
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>แผนที่คุณภาพอากาศ</Text>
        </View>
        
        {/* 🟢 Shortcuts Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsRow}>
          <TouchableOpacity style={styles.addShortcutBtn} onPress={() => setShowAddressModal(true)}>
            <Text style={styles.addShortcutText}>+ เพิ่มที่อยู่</Text>
          </TouchableOpacity>

          {DEFAULT_SHORTCUTS.map(sc => (
            <TouchableOpacity key={sc.id} style={styles.shortcutChip} onPress={() => handleShortcutPress(sc)}>
              <Text style={styles.shortcutText}>{sc.nickname}</Text>
            </TouchableOpacity>
          ))}

          {Object.values(customPins).map(pin => (
            <TouchableOpacity key={pin.id}
              style={[styles.shortcutChip, selectedKey === `pin-${pin.id}` && styles.shortcutChipActive]}
              onPress={() => handleShortcutPress(pin)}
              onLongPress={() => Alert.alert('ลบที่อยู่นี้?', pin.nickname, [
                { text: 'ยกเลิก', style: 'cancel' },
                { text: 'ลบออก', style: 'destructive', onPress: () => removeCustomPin(pin.id) },
              ])}
            >
              <Text style={[styles.shortcutText, selectedKey === `pin-${pin.id}` && styles.shortcutTextActive]}>{pin.nickname}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {POLLUTANT_TABS.map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {!isLoading && (
          <View style={fStyles.wrapper}>
            <Text style={fStyles.label}>★ ติดดาว</Text>
            <FavoritesStrip
              favorites={favorites} stationsData={stationsData}
              activeTab={activeTab} selectedKey={selectedKey}
              onSelect={(s) => { handleSelectStation(s); }}
              onRemoveFav={removeFavorite}
            />
          </View>
        )}
      </View>

      {/* ── MAP ── */}
      <View style={styles.mapWrapper}>
        
        {/* 🌟 ปุ่มกลับไปยังตำแหน่งของฉัน (ลอยอยู่มุมขวาบนของ Map) */}
        {location && (
          <TouchableOpacity style={styles.myLocationFab} onPress={handleMyLocationPress} activeOpacity={0.8}>
            <MaterialCommunityIcons name="crosshairs-gps" size={26} color="#1565C0" />
          </TouchableOpacity>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2C5282" />
            <Text style={styles.loadingText}>กำลังดึงข้อมูล…</Text>
          </View>
        ) : (
          <MapView ref={mapRef} style={styles.map}
            initialRegion={{ latitude: selectedStation?.lat ?? 15.0, longitude: selectedStation?.lon ?? 102.5, latitudeDelta: 1.5, longitudeDelta: 1.5 }}
          >
            {stationsData.map(station => {
              const val       = getPollutantValue(station, activeTab);
              const pmColor   = getPMColor(val);
              const textColor = getPMTextColor(val);
              const isSelected = selectedStation?.id === station.id;
              const isAir4    = station.network === 'Air4Thai';
              const isMock    = station.network === 'Mock Data';
              const faved     = !!favorites[station.id];
              return (
                <Marker key={station.id} coordinate={{ latitude: station.lat, longitude: station.lon }} onPress={() => handleSelectStation(station)}>
                  <View style={styles.markerContainer}>
                    {faved && <Text style={styles.markerStar}>★</Text>}
                    <View style={[styles.markerDot, { backgroundColor: pmColor }, isSelected && styles.selectedMarkerDot]}>
                      <Text style={[styles.markerDotText, { color: textColor }, isSelected && { fontSize: 13 }]}>
                        {val !== null ? val : 'N/A'}
                      </Text>
                    </View>
                    <View style={[styles.networkBadge, isMock ? styles.badgeMock : isAir4 ? styles.badgeAir4 : styles.badgeCMU]}>
                      <Text style={[styles.networkBadgeText, isMock ? styles.textMock : isAir4 ? styles.textAir4 : styles.textCMU]}>
                        {isMock ? 'Mock' : isAir4 ? 'Air4' : 'CMU'}
                      </Text>
                    </View>
                  </View>
                </Marker>
              );
            })}

            {Object.values(customPins).map(pin => {
              const nearest  = findNearest(pin.lat, pin.lon);
              const val      = getPollutantValue(nearest, activeTab);
              const color    = getPMColor(val);
              const isActive = selectedPin?.id === pin.id;
              return (
                <Marker key={pin.id} coordinate={{ latitude: pin.lat, longitude: pin.lon }} onPress={() => handleSelectPin(pin, nearest)}>
                  <View style={[styles.pinMarker, isActive && styles.pinMarkerActive]}>
                    <Text style={styles.pinEmoji}>📍</Text>
                    <View style={[styles.pinBubble, { backgroundColor: color }]}>
                      <Text style={styles.pinBubbleText}>{val !== null ? val : '?'}</Text>
                    </View>
                    <Text style={styles.pinName} numberOfLines={1}>{pin.nickname}</Text>
                  </View>
                </Marker>
              );
            })}

            {/* 🌟 หมุดแสดงตำแหน่งของฉันแบบมีสีตามค่าฝุ่น */}
            {location && myLocationStation && (
              <Marker
                coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                onPress={handleMyLocationPress}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={999}
              >
                {(() => {
                  const myVal = getPollutantValue(myLocationStation, activeTab);
                  const myColor = getPMColor(myVal);
                  return (
                    <View style={styles.myLocationMarker}>
                      <View style={[styles.myLocationPulse, { backgroundColor: myColor + '40' }]} />
                      <View style={[styles.myLocationDot, isMyLocSelected && styles.myLocationDotActive, { backgroundColor: myColor, borderColor: '#fff' }]} />
                      <View style={[styles.myLocationBubble, { backgroundColor: myColor }]}>
                        <Text style={styles.myLocationBubbleText}>
                          📍 ฉัน · {myVal !== null ? `${myVal}` : '?'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </Marker>
            )}
          </MapView>
        )}
      </View>

      {/* ── BOTTOM CARD (ANIMATED BOTTOM SHEET) ── */}
      {!isLoading && (
        <Animated.View style={[
          styles.bottomCard, 
          { 
            height: MAX_PANEL_HEIGHT,
            transform: [{ translateY: panelY }] 
          }
        ]}>
          <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
            <TouchableOpacity onPress={togglePanel} style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.bottomContent}
            scrollEnabled={true}
          >
            {!(selectedStation || selectedPin) ? (
              <View style={styles.emptyCardContent}>
                <Text style={styles.emptyCardIcon}>🗺️</Text>
                <Text style={styles.emptyCardTitle}>แตะที่สถานีบนแผนที่</Text>
                <Text style={styles.emptyCardSub}>หรือแตะจุดน้ำเงิน 📍 เพื่อดูข้อมูลตำแหน่งปัจจุบัน</Text>
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
                  <View style={styles.legendRow}>
                    {COLOR_LEGEND.map(item => (
                      <View key={item.label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    {selectedPin ? (
                      <>
                        <Text style={[styles.cardStationName, { color: '#E6A817', fontWeight: '700' }]}>📍 {selectedPin.nickname}</Text>
                        <Text style={styles.cardFullAddress} numberOfLines={2}>{selectedPin.displayName}</Text>
                        <Text style={styles.cardProvince}>{nearestForPin?.province ?? ''}</Text>
                        <Text style={styles.cardUpdated}>
                          ใช้ข้อมูลจาก: {nearestForPin?.name ?? '—'}{'  ·  '}{nearestForPin ? `${Math.round(getDistanceKm(selectedPin.lat, selectedPin.lon, nearestForPin.lat, nearestForPin.lon))} km` : ''}
                        </Text>
                      </>
                    ) : (
                      <>
                        {isMyLocSelected && (
                          <View style={styles.myLocBadge}>
                            <Text style={styles.myLocBadgeText}>📍 ตำแหน่งของคุณ</Text>
                            {myDistKm !== null && (
                              <Text style={styles.myLocDistText}>สถานีใกล้สุด {myDistKm} km</Text>
                            )}
                          </View>
                        )}
                        <Text style={styles.cardStationName} numberOfLines={1}>{selectedStation.name}</Text>
                        <Text style={styles.cardProvince}>{selectedStation.province}</Text>
                        <Text style={styles.cardUpdated}>
                          อัปเดต {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.{'  ·  '}{selectedStation.network}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={styles.cardRight}>
                    {selectedStation && (
                      <>
                        <TouchableOpacity
                          style={[styles.starBtn, isFav && styles.starBtnActive]}
                          onPress={() => isFav ? removeFavorite(selectedStation.id) : setShowAddFavModal(true)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.starBtnText, isFav && styles.starBtnTextActive]}>{isFav ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                        {isFav && <Text style={styles.favLabel}>{favorites[selectedStation.id]?.nickname}</Text>}
                      </>
                    )}
                    <View style={styles.cardValueBlock}>
                      {activeValue !== null ? (
                        <><Text style={[styles.cardValue, { color: activeColor }]}>{activeValue}</Text><Text style={styles.cardUnit}>µg/m³</Text></>
                      ) : <Text style={styles.cardNoData}>N/A</Text>}
                    </View>
                  </View>
                </View>

                <View style={styles.badgeRow}>
                  <View style={[styles.statusBadge, { backgroundColor: activeColor }]}>
                    <Text style={styles.statusBadgeText}>{getPMStatus(activeValue)}</Text>
                  </View>
                  {activeStation?.aqi !== null && activeStation?.aqi !== undefined && (
                    <View style={styles.aqiBadge}><Text style={styles.aqiBadgeText}>AQI {activeStation.aqi}</Text></View>
                  )}
                </View>

                <View style={[styles.adviceBox, { backgroundColor: `${activeColor}15`, borderColor: `${activeColor}40` }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.adviceTitle, { color: activeColor }]}>คำแนะนำสุขภาพ</Text>
                    <Text style={styles.adviceText}>{getHealthAdvice(activeValue)}</Text>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={styles.pollutantRow}>
                  {POLLUTANT_TABS.map(tab => {
                    const v   = getPollutantValue(activeStation, tab);
                    const col = getPMColor(v);
                    return (
                      <TouchableOpacity key={tab} style={[styles.pollutantPill, tab === activeTab && { borderColor: col, borderWidth: 2 }]} onPress={() => setActiveTab(tab)}>
                        <Text style={styles.pollutantPillLabel}>{tab}</Text>
                        <Text style={[styles.pollutantPillValue, { color: v !== null ? col : '#bbb' }]}>{v !== null ? v : 'N/A'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.chartArea}>
                  {historyLoading
                    ? <ActivityIndicator color={activeColor} />
                    : historyData.length > 1
                      ? <SparkChart data={historyData} color={activeColor} />
                      : <Text style={styles.noChart}>ไม่มีข้อมูลประวัติ</Text>
                  }
                </View>

                {weather && (
                  <View style={styles.weatherRow}>
                    {[['🌡', `${weather.temp}°C`], ['💧', `${weather.humidity}%`], ['💨', `${weather.wind} km/h`]].map(([icon, val]) => (
                      <View key={icon} style={styles.weatherPill}>
                        <Text style={styles.weatherIcon}>{icon}</Text>
                        <Text style={styles.weatherValue}>{val}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* 🌟 (โค้ดใหม่) กล่องคำอธิบายค่ามลพิษตาม Tab ที่เลือก */}
                <View style={styles.pollutantInfoBox}>
                  <Text style={styles.pollutantInfoTitle}>💡 รู้หรือไม่? {activeTab} คืออะไร</Text>
                  <Text style={styles.pollutantInfoText}>{getPollutantInfo(activeTab)}</Text>
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* ── MODALS ── */}
      <AddFavoriteModal
        visible={showAddFavModal}
        stationName={selectedStation?.name}
        province={selectedStation?.province}
        onConfirm={(nick) => { addFavorite(selectedStation, nick); setShowAddFavModal(false); setSelectedKey(`fav-${selectedStation.id}`); }}
        onCancel={() => setShowAddFavModal(false)}
      />
      <AddressSearchModal
        visible={showAddressModal}
        onFound={handleGeoFound}
        onCancel={() => setShowAddressModal(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const fStyles = StyleSheet.create({
  wrapper:    { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  label:      { fontSize: 11, fontWeight: '700', color: '#E6A817', marginBottom: 5, letterSpacing: 0.5 },
  row:        { gap: 8, paddingRight: 12 },
  emptyWrap:  { paddingHorizontal: 12, paddingVertical: 6 },
  emptyText:  { fontSize: 12, color: '#BCAAA4', fontStyle: 'italic' },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF9EC', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: '#F5E0A0' },
  chipActive: { borderColor: '#E6A817', elevation: 3 },
  dot:        { width: 10, height: 10, borderRadius: 5 },
  name:       { fontSize: 13, fontWeight: '700', color: '#3D2E00', maxWidth: 110 },
  val:        { fontSize: 11, fontWeight: '600', marginTop: 1 },
});

const mStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title:       { fontSize: 18, fontWeight: '800', color: '#1565C0', marginBottom: 10 },
  sub:         { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  sub2:        { fontSize: 12, color: '#888', marginBottom: 14 },
  label:       { fontSize: 12, color: '#999', marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: '#1565C0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#333', marginBottom: 16, backgroundColor: '#F0F7FF' },
  errorText:   { color: '#E53935', fontSize: 13, marginTop: -10, marginBottom: 12 },
  btnRow:      { flexDirection: 'row', gap: 12 },
  cancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelText:  { fontSize: 15, fontWeight: '600', color: '#888' },
  confirmBtn:  { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1565C0', alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F5F7FA' },
  header:             { backgroundColor: '#fff', paddingTop: 56, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#EEE', zIndex: 10 },
  headerRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  headerTitle:        { fontSize: 20, fontWeight: '700' },
  
  shortcutsRow:       { paddingHorizontal: 16, gap: 8, flexDirection: 'row', marginBottom: 12 },
  addShortcutBtn:     { backgroundColor: '#EBF3FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#B3D4F5', justifyContent: 'center' },
  addShortcutText:    { fontSize: 13, fontWeight: '700', color: '#1565C0' },
  shortcutChip:       { backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', justifyContent: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  shortcutChipActive: { borderColor: '#1565C0', backgroundColor: '#F0F7FF' },
  shortcutText:       { fontSize: 13, fontWeight: '600', color: '#444' },
  shortcutTextActive: { color: '#1565C0', fontWeight: '700' },

  tabsRow:            { paddingHorizontal: 12, gap: 8, flexDirection: 'row' },
  tab:                { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F0F0' },
  tabActive:          { backgroundColor: '#1565C0' },
  tabText:            { fontSize: 13, color: '#555', fontWeight: '600' },
  tabTextActive:      { color: '#fff' },
  mapWrapper:         { flex: 1 },
  map:                { width: '100%', height: '100%' },
  loadingContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:        { marginTop: 12, color: '#4A5568', fontSize: 14 },

  // 🌟 สไตล์ปุ่มกดกลับมาที่จุดของฉัน
  myLocationFab: {
    position: 'absolute',
    right: 16,
    top: 20, 
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },

  markerContainer:    { alignItems: 'center' },
  markerStar:         { fontSize: 12, color: '#E6A817', marginBottom: -2 },
  markerDot:          { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  selectedMarkerDot:  { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#1565C0', elevation: 8 },
  markerDotText:      { fontSize: 11, fontWeight: '700' },
  networkBadge:       { marginTop: -3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, elevation: 5 },
  networkBadgeText:   { fontSize: 9, fontWeight: '700' },
  badgeAir4:          { backgroundColor: '#E1F5FE', borderColor: '#29B6F6' },
  badgeCMU:           { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  badgeMock:          { backgroundColor: '#FFEBEE', borderColor: '#E53935' },
  textAir4:           { color: '#0277BD' },
  textCMU:            { color: '#2E7D32' },
  textMock:           { color: '#C62828' },

  pinMarker:          { alignItems: 'center', minWidth: 60 },
  pinMarkerActive:    { transform: [{ scale: 1.1 }] },
  pinEmoji:           { fontSize: 28 },
  pinBubble:          { marginTop: -6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, elevation: 3 },
  pinBubbleText:      { color: '#fff', fontSize: 11, fontWeight: '800' },
  pinName:            { fontSize: 10, fontWeight: '700', color: '#1a1a2e', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 4, borderRadius: 4, marginTop: 1, maxWidth: 80, textAlign: 'center' },

  myLocationMarker:      { alignItems: 'center', justifyContent: 'center' },
  myLocationPulse:       { position: 'absolute', width: 40, height: 40, borderRadius: 20 },
  myLocationDot:         { width: 20, height: 20, borderRadius: 10, borderWidth: 3, elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  myLocationDotActive:   { width: 24, height: 24, borderRadius: 12 },
  myLocationBubble:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4, elevation: 3 },
  myLocationBubbleText:  { color: '#fff', fontSize: 11, fontWeight: '700' },

  bottomCard: { 
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    elevation: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -5 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 10 
  },
  dragHandleArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'transparent'
  },
  dragHandleContainer: {
    width: 60,
    height: 20,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CCC'
  },
  bottomContent: {
    paddingHorizontal: 16,
    paddingBottom: 40, 
  },

  emptyCardContent:   { alignItems: 'center', paddingVertical: 18, marginTop: 10 },
  emptyCardIcon:      { fontSize: 32, marginBottom: 8 },
  emptyCardTitle:     { fontSize: 15, fontWeight: '700', color: '#4A5568' },
  emptyCardSub:       { fontSize: 13, color: '#A0AEC0', marginTop: 4 },

  myLocBadge:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EBF3FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6, alignSelf: 'flex-start' },
  myLocBadgeText:     { fontSize: 12, fontWeight: '700', color: '#1565C0' },
  myLocDistText:      { fontSize: 11, color: '#4A90D9', fontWeight: '500' },

  legendScroll:       { marginBottom: 10 },
  legendRow:          { flexDirection: 'row', gap: 10, paddingRight: 8 },
  legendItem:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:          { width: 10, height: 10, borderRadius: 5 },
  legendLabel:        { fontSize: 10, color: '#555' },
  
  cardHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardStationName:    { fontSize: 13, color: '#555' },
  
  cardFullAddress:    { fontSize: 13, color: '#444', marginBottom: 4, lineHeight: 18 },
  
  cardProvince:       { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  cardUpdated:        { fontSize: 11, color: '#999', marginTop: 2 },
  cardRight:          { alignItems: 'flex-end', gap: 4 },
  cardValueBlock:     { alignItems: 'flex-end' },
  cardValue:          { fontSize: 32, fontWeight: '800' },
  cardUnit:           { fontSize: 11, color: '#aaa', marginTop: -4 },
  cardNoData:         { fontSize: 22, fontWeight: '700', color: '#BDBDBD' },
  starBtn:            { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5, borderColor: '#D0D0D0', backgroundColor: '#F9F9F9' },
  starBtnActive:      { borderColor: '#E6A817', backgroundColor: '#FFF9EC' },
  starBtnText:        { fontSize: 18, color: '#CCCCCC' },
  starBtnTextActive:  { fontSize: 18, color: '#E6A817' },
  favLabel:           { fontSize: 11, color: '#E6A817', fontWeight: '600', maxWidth: 100 },
  
  badgeRow:           { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statusBadge:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusBadgeText:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  aqiBadge:           { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#90CAF9' },
  aqiBadgeText:       { color: '#1565C0', fontSize: 13, fontWeight: '700' },

  adviceBox:          { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1.5 },
  adviceTitle:        { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  adviceText:         { fontSize: 15, color: '#222', lineHeight: 24, fontWeight: '500' },

  pollutantRow:       { gap: 8, paddingRight: 8 },
  pollutantPill:      { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: 'transparent', minWidth: 56 },
  pollutantPillLabel: { fontSize: 10, color: '#888', fontWeight: '600' },
  pollutantPillValue: { fontSize: 15, fontWeight: '800', marginTop: 1 },
  chartArea:          { marginBottom: 10, minHeight: 70 },
  noChart:            { color: '#bbb', textAlign: 'center', marginVertical: 10, fontSize: 13 },
  weatherRow:         { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 4 },
  weatherPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F4FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  weatherIcon:        { fontSize: 14 },
  weatherValue:       { fontSize: 13, color: '#334', fontWeight: '600' },

// 🌟 สไตล์กล่องคำอธิบายมลพิษ
  pollutantInfoBox: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pollutantInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C5282',
    marginBottom: 6,
  },
  pollutantInfoText: {
    fontSize: 16,
    color: '#4A5568',
    lineHeight: 22,
  },
});