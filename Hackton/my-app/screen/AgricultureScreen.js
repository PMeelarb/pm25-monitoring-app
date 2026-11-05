import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Dimensions,
  Animated, PanResponder
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CROP_TYPES = {
  rice:        { label: 'ข้าว',      color: '#A5D6A7', emoji: '🌾' },
  sugarcane:   { label: 'อ้อย',      color: '#FFF59D', emoji: '🎋' },
  cassava:     { label: 'มันสำปะหลัง', color: '#FFCC80', emoji: '🥔' },
  corn:        { label: 'ข้าวโพด',   color: '#FFE082', emoji: '🌽' },
  rubber:      { label: 'ยางพารา',   color: '#80CBC4', emoji: '🌳' },
  other:       { label: 'อื่นๆ',     color: '#E0E0E0', emoji: '🌿' },
};

// ─── SUITABILITY INDEX (อัปเดตให้รองรับชนิดพืช) ───────────────────────────────────
const calcFarmingIndex = ({ pm25, temp, humidity, cropType }) => {
  const pm25Score = pm25 === null ? 50 : pm25 <= 25 ? 100 : pm25 <= 37 ? 80 : pm25 <= 50 ? 60 : pm25 <= 90 ? 30 : 0;
  let tempScore = 50;
  let humScore = 50;

  if (temp !== null && temp !== '--') {
    if (cropType === 'cassava') { // มันสำปะหลังทนร้อนได้ดี
      tempScore = temp >= 25 && temp <= 35 ? 100 : temp > 35 && temp <= 40 ? 80 : temp > 40 ? 40 : 60;
    } else {
      tempScore = temp >= 20 && temp <= 32 ? 100 : temp >= 15 && temp < 20 ? 70 : temp > 32 && temp <= 38 ? 60 : temp > 38 ? 20 : 40;
    }
  }

  if (humidity !== null && humidity !== '--') {
    if (cropType === 'rubber') { // ยางพาราไม่ชอบความชื้นสูงมากตอนกรีด
      humScore = humidity >= 50 && humidity <= 75 ? 100 : humidity > 75 && humidity <= 85 ? 70 : humidity > 85 ? 40 : 60;
    } else {
      humScore = humidity >= 60 && humidity <= 80 ? 100 : humidity >= 45 && humidity < 60 ? 75 : humidity > 80 ? 70 : humidity < 45 ? 40 : 50;
    }
  }

  return Math.round(pm25Score * 0.4 + tempScore * 0.4 + humScore * 0.2);
};

const getIndexColor = (score) => {
  if (score >= 80) return '#2E7D32';
  if (score >= 60) return '#F9A825';
  if (score >= 40) return '#E64A19';
  return '#B71C1C';
};

const getIndexLabel = (score) => {
  if (score >= 80) return 'เหมาะสมมาก';
  if (score >= 60) return 'พอใช้ได้';
  if (score >= 40) return 'ควรระวัง';
  return 'ไม่เหมาะสม';
};

// ─── DAILY RECOMMENDATION (อัปเดตคำแนะนำเฉพาะพืช) ──────────────────────────────────
const getDailyRecommendation = ({ pm25, temp, humidity, cropType }) => {
  const tips = [];
  const warnings = [];

  if (pm25 !== null) {
    if (pm25 > 90) {
      warnings.push('⛔ PM2.5 อันตราย — งดทำงานกลางแจ้งทุกชนิด');
      warnings.push('🚫 ห้ามเผาตอซังหรือเศษพืชโดยเด็ดขาด');
    } else if (pm25 > 50) {
      warnings.push('⚠️ ฝุ่นสูง — สวมหน้ากาก N95 ขณะทำงานในไร่');
    } else if (pm25 <= 25) {
      tips.push('✅ คุณภาพอากาศดี — เหมาะสำหรับทำงานกลางแจ้ง');
    }
  }

  if (temp !== null && temp !== '--') {
    if (temp > 38) {
      warnings.push('🌡 อุณหภูมิสูงมาก — ระวังพืชขาดน้ำและอาการฮีทสโตรก');
    }
  }

  if (humidity !== null && humidity !== '--') {
    if (humidity > 85) {
      warnings.push('💧 ความชื้นสูง — เสี่ยงโรคเชื้อราในแปลงเพาะปลูก');
    }
  }

  // คำแนะนำเฉพาะพืช
  if (cropType === 'rice') tips.push('🌾 ข้าว: ตรวจสอบระดับน้ำในนาให้เหมาะสมกับช่วงการเจริญเติบโต');
  if (cropType === 'sugarcane') tips.push('🎋 อ้อย: หมั่นกำจัดวัชพืชเพื่อไม่ให้แย่งอาหาร');
  if (cropType === 'cassava') tips.push('🥔 มันสำปะหลัง: ทนแล้งได้ดี แต่อย่าปล่อยให้มีน้ำขังที่โคนต้น');
  if (cropType === 'corn') tips.push('🌽 ข้าวโพด: เฝ้าระวังหนอนกระทู้ในช่วงอากาศเปลี่ยนแปลง');
  if (cropType === 'rubber' && humidity > 80) warnings.push('🌳 ยางพารา: ความชื้นสูง หน้าต้นยางอาจเปียก กรีดยางได้ยาก');

  const sprayOk = pm25 !== null && pm25 <= 37 && temp !== '--' && temp >= 18 && temp <= 35 && humidity < 85;
  if (sprayOk) {
    tips.push('🌿 สภาพอากาศเหมาะสำหรับพ่นยา/ให้ปุ๋ยทางใบวันนี้');
  }

  return { tips, warnings };
};

// ─── MOCK LDD FARM ZONES (เพิ่มข้อมูลพืชครบทุกชนิด) ────────────────────────────────
const MOCK_FARM_ZONES = [
  {
    id: 'z1', crop: 'rice', province: 'นครราชสีมา',
    polygon: [
      { latitude: 14.97, longitude: 102.08 },
      { latitude: 14.97, longitude: 102.22 },
      { latitude: 14.85, longitude: 102.22 },
      { latitude: 14.85, longitude: 102.08 },
    ],
    areaSqKm: 245,
    centerLat: 14.91, centerLon: 102.15,
  },
  {
    id: 'z2', crop: 'sugarcane', province: 'นครราชสีมา',
    polygon: [
      { latitude: 15.10, longitude: 102.30 },
      { latitude: 15.10, longitude: 102.45 },
      { latitude: 14.98, longitude: 102.45 },
      { latitude: 14.98, longitude: 102.30 },
    ],
    areaSqKm: 180,
    centerLat: 15.04, centerLon: 102.375,
  },
  {
    id: 'z3', crop: 'cassava', province: 'นครราชสีมา',
    polygon: [
      { latitude: 14.98, longitude: 101.85 },
      { latitude: 14.98, longitude: 101.95 },
      { latitude: 14.92, longitude: 101.95 },
      { latitude: 14.92, longitude: 101.85 },
    ],
    areaSqKm: 120,
    centerLat: 14.95, centerLon: 101.90,
  },
  {
    id: 'z4', crop: 'corn', province: 'นครราชสีมา',
    polygon: [
      { latitude: 15.20, longitude: 102.15 },
      { latitude: 15.20, longitude: 102.25 },
      { latitude: 15.10, longitude: 102.25 },
      { latitude: 15.10, longitude: 102.15 },
    ],
    areaSqKm: 95,
    centerLat: 15.15, centerLon: 102.20,
  },
  {
    id: 'z5', crop: 'rubber', province: 'นครราชสีมา',
    polygon: [
      { latitude: 14.75, longitude: 102.25 },
      { latitude: 14.75, longitude: 102.35 },
      { latitude: 14.65, longitude: 102.35 },
      { latitude: 14.65, longitude: 102.25 },
    ],
    areaSqKm: 150,
    centerLat: 14.70, centerLon: 102.30,
  },
  {
    id: 'z6', crop: 'other', province: 'นครราชสีมา',
    polygon: [
      { latitude: 14.85, longitude: 101.90 },
      { latitude: 14.85, longitude: 102.00 },
      { latitude: 14.75, longitude: 102.00 },
      { latitude: 14.75, longitude: 101.90 },
    ],
    areaSqKm: 60,
    centerLat: 14.80, centerLon: 101.95,
  }
];

const fetchLDDFarmZones = async () => {
  try {
    const bbox = '101.0,14.0,104.5,16.5'; 
    const url  = `https://lddservice.ldd.go.th/arcgis/rest/services/LDD_WMS/MapServer/0/query?where=1%3D1&geometry=${bbox}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=json&resultRecordCount=50`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (!data.features?.length) throw new Error('empty');

    return data.features.map((f, i) => {
      const attr  = f.attributes ?? {};
      const rings = f.geometry?.rings?.[0] ?? [];
      const poly  = rings.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
      const cropRaw = (attr.LANDUSE_TH || attr.LU_CODE || '').toLowerCase();

      let crop = 'other';
      if (cropRaw.includes('ข้าว') || cropRaw.includes('rice'))  crop = 'rice';
      else if (cropRaw.includes('อ้อย') || cropRaw.includes('sugar')) crop = 'sugarcane';
      else if (cropRaw.includes('มัน')  || cropRaw.includes('cassava')) crop = 'cassava';
      else if (cropRaw.includes('ข้าวโพด') || cropRaw.includes('corn'))  crop = 'corn';
      else if (cropRaw.includes('ยาง')  || cropRaw.includes('rubber')) crop = 'rubber';

      const lats = poly.map(p => p.latitude);
      const lons = poly.map(p => p.longitude);

      return {
        id:         `ldd-${i}`,
        crop,
        province:   attr.PROVINCE_TH || attr.CHANGWAT || 'ไม่ระบุ',
        polygon:    poly,
        areaSqKm:   Math.round((attr.AREA_SQM ?? 0) / 1e6) || 1,
        centerLat:  lats.reduce((a, b) => a + b, 0) / lats.length,
        centerLon:  lons.reduce((a, b) => a + b, 0) / lons.length,
      };
    });
  } catch (e) {
    console.log('[LDD] API unavailable, using mock data:', e.message);
    return MOCK_FARM_ZONES;
  }
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AgricultureScreen() {
  const [farmZones, setFarmZones]           = useState([]);
  const [selectedZone, setSelectedZone]     = useState(null);
  const [weather, setWeather]               = useState(null);
  const [pm25, setPm25]                     = useState(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [cropFilter, setCropFilter]         = useState('all');
  const [location, setLocation]             = useState(null);
  const [lddSource, setLddSource]           = useState('mock');
  const [notifEnabled, setNotifEnabled]     = useState(false);

  // ─── Bottom Sheet Setup ───────────────────────────────────────────────────────
  const MAX_PANEL_HEIGHT = SCREEN_HEIGHT * 0.65;
  const MIN_PANEL_HEIGHT = 160; 
  
  const panelY = useRef(new Animated.Value(MAX_PANEL_HEIGHT - MIN_PANEL_HEIGHT)).current;
  const isPanelOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          openPanel();
        } else if (gestureState.dy > 50) {
          closePanel();
        } else {
          isPanelOpen.current ? openPanel() : closePanel();
        }
      },
    })
  ).current;

  const openPanel = () => {
    isPanelOpen.current = true;
    Animated.spring(panelY, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 8
    }).start();
  };

  const closePanel = () => {
    isPanelOpen.current = false;
    Animated.spring(panelY, {
      toValue: MAX_PANEL_HEIGHT - MIN_PANEL_HEIGHT,
      useNativeDriver: false,
      bounciness: 8
    }).start();
  };

  const togglePanel = () => {
    isPanelOpen.current ? closePanel() : openPanel();
  };

  // ─── Setup notifications ────────────────────────────────────────────────────
  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      setNotifEnabled(true);
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge:  false,
        }),
      });
    }
  };

  const sendAlert = useCallback(async (title, body) => {
    if (!notifEnabled) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  }, [notifEnabled]);

  // ─── Fetch weather + PM2.5 ──────────────────────────────────────────────────
  const fetchWeatherAndAir = async (lat, lon) => {
    try {
      const wRes  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&forecast_days=1&timezone=Asia%2FBangkok`);
      const wData = await wRes.json();
      const hour  = new Date().getHours();
      setWeather({
        temp:     wData.current_weather?.temperature  ?? null,
        humidity: wData.hourly?.relativehumidity_2m?.[hour] ?? null,
        wind:     wData.current_weather?.windspeed    ?? null,
      });

      const aRes  = await fetch('http://air4thai.com/forweb/getAQI_JSON.php');
      const aData = await aRes.json();
      let minDist = Infinity, nearPM25 = null;
      for (const s of aData.stations ?? []) {
        const dlat = (parseFloat(s.lat) - lat) ** 2;
        const dlon = (parseFloat(s.long) - lon) ** 2;
        const d    = Math.sqrt(dlat + dlon);
        if (d < minDist) {
          const v = parseFloat(s.AQILast?.PM25?.value);
          if (isFinite(v) && v > 0) { minDist = d; nearPM25 = v; }
        }
      }
      setPm25(nearPM25);
    } catch (e) {
      console.error('Weather/Air error:', e);
    }
  };

  // ─── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await setupNotifications();

      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 14.98, lon = 102.10; 
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
        setLocation({ latitude: lat, longitude: lon });
      }

      const [zones] = await Promise.all([
        fetchLDDFarmZones(),
        fetchWeatherAndAir(lat, lon),
      ]);

      setFarmZones(zones);
      setLddSource(zones[0]?.id?.startsWith('ldd') ? 'ldd' : 'mock');
      if (zones.length > 0) setSelectedZone(zones[0]);

      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (pm25 !== null && pm25 > 90) {
      sendAlert('⚠️ คุณภาพอากาศอันตรายต่อพืช', `PM2.5 = ${pm25} µg/m³ — งดทำกิจกรรมกลางแจ้งและห้ามเผาตอซัง`);
    } else if (pm25 !== null && pm25 > 50) {
      sendAlert('🌫 ฝุ่นสูง — ระวังการพ่นสารเคมี', `PM2.5 = ${pm25} µg/m³ — ควรสวมหน้ากาก N95 ขณะทำงานในไร่`);
    }
  }, [pm25]);

  const farmingIndex   = calcFarmingIndex({ pm25, temp: weather?.temp, humidity: weather?.humidity, cropType: selectedZone?.crop });
  const indexColor     = getIndexColor(farmingIndex);
  const indexLabel     = getIndexLabel(farmingIndex);
  const { tips, warnings } = getDailyRecommendation({ pm25, temp: weather?.temp, humidity: weather?.humidity, cropType: selectedZone?.crop });

  const filteredZones = cropFilter === 'all'
    ? farmZones
    : farmZones.filter(z => z.crop === cropFilter);

  // ─── การจัดการ Filter (ลบระบบออโต้เด้งออก) ──────────────────────────────────────────
  // ─── การจัดการ Filter ──────────────────────────────────────────
  const handleFilterChange = (type) => {
    setCropFilter(type); 

    const matchedZones = type === 'all' 
      ? farmZones 
      : farmZones.filter(z => z.crop === type);

    if (matchedZones.length > 0) {
      const isCurrentZoneStillValid = matchedZones.some(z => z.id === selectedZone?.id);
      if (!isCurrentZoneStillValid) {
        setSelectedZone(matchedZones[0]);
      }
    } else {
      setSelectedZone(null); 
    }
    
    // 🟢 บังคับให้แท็บพับเก็บลงไปเสมอ เวลากดเลือกหัวข้อด้านบน
    closePanel();
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🌾 แผนที่เกษตรกรรม</Text>
        {lddSource === 'mock' && (
          <Text style={styles.mockBadge}></Text>
        )}

        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, cropFilter === 'all' && styles.filterChipActive]}
            onPress={() => handleFilterChange('all')}
          >
            <Text style={[styles.filterChipText, cropFilter === 'all' && styles.filterChipTextActive]}>
              🗺 ทั้งหมด
            </Text>
          </TouchableOpacity>
          {Object.entries(CROP_TYPES).map(([key, val]) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, cropFilter === key && styles.filterChipActive, { borderColor: val.color }]}
              onPress={() => handleFilterChange(key)}
            >
              <Text style={[styles.filterChipText, cropFilter === key && styles.filterChipTextActive]}>
                {val.emoji} {val.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูลแปลงเกษตร…</Text>
        </View>
      ) : (
        <>
          {/* MAP */}
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude:       location?.latitude  ?? 14.98,
                longitude:      location?.longitude ?? 102.10,
                latitudeDelta:  1.0, 
                longitudeDelta: 1.0, 
              }}
            >
              {/* เติม cropFilter เข้าไปใน key เพื่อบังคับให้แผนที่ลบและวาดเส้นใหม่เมื่อเปลี่ยนฟิลเตอร์ */}
              {filteredZones.map(zone => {
                const cropInfo = CROP_TYPES[zone.crop] ?? CROP_TYPES.other;
                const isSelected = selectedZone?.id === zone.id;
                return (
                  <Polygon
                    key={`poly-${zone.id}-${cropFilter}`}
                    coordinates={zone.polygon}
                    fillColor={`${cropInfo.color}88`}
                    strokeColor={isSelected ? '#1B5E20' : cropInfo.color}
                    strokeWidth={isSelected ? 3 : 1.5}
                    tappable
                    onPress={() => {
                      setSelectedZone(zone);
                      // ลบ openPanel() ออก
                    }}
                  />
                );
              })}

              {filteredZones.map(zone => {
                const cropInfo = CROP_TYPES[zone.crop] ?? CROP_TYPES.other;
                const isSelected = selectedZone?.id === zone.id;
                return (
                  <Marker
                    key={`marker-${zone.id}-${cropFilter}`}
                    coordinate={{ latitude: zone.centerLat, longitude: zone.centerLon }}
                    onPress={() => {
                      setSelectedZone(zone);
                      // ลบ openPanel() ออก
                    }}
                  >
                    <View style={[styles.cropMarker, isSelected && styles.cropMarkerSelected, { backgroundColor: cropInfo.color }]}>
                      <Text style={styles.cropMarkerEmoji}>{cropInfo.emoji}</Text>
                    </View>
                  </Marker>
                );
              })}

              {location && (
                <Marker coordinate={location}>
                  <View style={styles.myDot} />
                </Marker>
              )}
            </MapView>

            <View style={[styles.indexOverlay, { borderColor: indexColor }]}>
              <Text style={styles.indexOverlayTitle}>ดัชนีความเหมาะสม</Text>
              <Text style={[styles.indexOverlayScore, { color: indexColor }]}>{farmingIndex}</Text>
              <Text style={[styles.indexOverlayLabel, { color: indexColor }]}>{indexLabel}</Text>
            </View>
          </View>

          {/* BOTTOM CARD ANIMATED (Bottom Sheet) */}
          <Animated.View 
            style={[
              styles.bottomCard, 
              { 
                height: MAX_PANEL_HEIGHT,
                transform: [{ translateY: panelY }] 
              }
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
              <TouchableOpacity onPress={togglePanel} style={styles.dragHandleContainer}>
                <View style={styles.dragHandle} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.bottomContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={true} 
            >
              <View style={styles.metricsRow}>
                <MetricPill icon="🌡" label="อุณหภูมิ"   value={weather?.temp     ? `${weather.temp}°C`    : 'N/A'} />
                <MetricPill icon="💧" label="ความชื้น"   value={weather?.humidity  ? `${weather.humidity}%` : 'N/A'} />
                <MetricPill icon="🌫" label="PM2.5"      value={pm25 !== null      ? `${pm25} µg/m³`        : 'N/A'} alert={pm25 > 50} />
                <MetricPill icon="💨" label="ลม"         value={weather?.wind     ? `${weather.wind} km/h` : 'N/A'} />
              </View>

              {selectedZone && (
                <View style={styles.zoneCard}>
                  <View style={styles.zoneCardHeader}>
                    <Text style={styles.zoneEmoji}>{CROP_TYPES[selectedZone.crop]?.emoji ?? '🌿'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneCropLabel}>
                        {CROP_TYPES[selectedZone.crop]?.label ?? 'พืชอื่นๆ'}
                      </Text>
                      <Text style={styles.zoneProvinceLabel}>{selectedZone.province}</Text>
                    </View>
                    <View style={styles.zoneAreaBadge}>
                      <Text style={styles.zoneAreaText}>{selectedZone.areaSqKm} ตร.กม.</Text>
                    </View>
                  </View>
                </View>
              )}

              {warnings.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🚨 คำเตือน</Text>
                  {warnings.map((w, i) => (
                    <View key={i} style={styles.warningItem}>
                      <Text style={styles.warningText}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}

              {tips.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💡 คำแนะนำวันนี้</Text>
                  {tips.map((t, i) => (
                    <View key={i} style={styles.tipItem}>
                      <Text style={styles.tipText}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 ดัชนีความเหมาะสมเกษตร</Text>
                <SuitabilityBar label="คุณภาพอากาศ (PM2.5)" score={
                  pm25 === null ? 50 : pm25 <= 25 ? 100 : pm25 <= 37 ? 80 : pm25 <= 50 ? 60 : pm25 <= 90 ? 30 : 0
                } />
                <SuitabilityBar label="อุณหภูมิ" score={
                  !weather?.temp || weather.temp === '--' ? 50
                    : weather.temp >= 20 && weather.temp <= 32 ? 100
                    : weather.temp > 32 && weather.temp <= 38 ? 60 : 20
                } />
                <SuitabilityBar label="ความชื้น" score={
                  !weather?.humidity || weather.humidity === '--' ? 50
                    : weather.humidity >= 60 && weather.humidity <= 80 ? 100
                    : weather.humidity >= 45 ? 75 : 40
                } />

                <View style={[styles.totalScoreRow, { borderColor: indexColor }]}>
                  <Text style={styles.totalScoreLabel}>ดัชนีรวม</Text>
                  <Text style={[styles.totalScoreValue, { color: indexColor }]}>
                    {farmingIndex}/100 — {indexLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🗺 สัญลักษณ์แผนที่</Text>
                <View style={styles.legendGrid}>
                  {Object.entries(CROP_TYPES).map(([key, val]) => (
                    <View key={key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: val.color }]} />
                      <Text style={styles.legendText}>{val.emoji} {val.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Text style={styles.sourceNote}>
                แหล่งข้อมูล: กรมพัฒนาที่ดิน (LDD) · Air4Thai · Open-Meteo{'\n'}
                {lddSource === 'mock' ? 'หมายเหตุ: ข้อมูลแปลงเกษตรเป็น Mock เนื่องจาก LDD API ไม่พร้อมใช้งาน' : 'ข้อมูลแปลงเกษตรจาก LDD'}
              </Text>
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function MetricPill({ icon, label, value, alert }) {
  return (
    <View style={[styles.metricPill, alert && styles.metricPillAlert]}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, alert && styles.metricValueAlert]}>{value}</Text>
    </View>
  );
}

function SuitabilityBar({ label, score }) {
  const color = getIndexColor(score);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barScore, { color }]}>{score}</Text>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F1F8E9' },

  header:     { backgroundColor: '#fff', paddingTop: 56, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#C8E6C9', zIndex: 10 },
  headerTitle:{ fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#1B5E20', marginBottom: 4 },
  mockBadge:  { fontSize: 11, color: '#E65100', textAlign: 'center', marginBottom: 6 },

  filterRow:  { paddingHorizontal: 12, gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F8E9', borderWidth: 1.5, borderColor: '#A5D6A7' },
  filterChipActive:     { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  filterChipText:       { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:      { marginTop: 12, color: '#388E3C', fontSize: 14 },

  mapWrapper:   { flex: 1 },
  map:          { width: '100%', height: '100%' },

  cropMarker:         { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },
  cropMarkerSelected: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#1B5E20', elevation: 8 },
  cropMarkerEmoji:    { fontSize: 16 },

  myDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#1565C0', borderWidth: 3, borderColor: '#fff' },

  indexOverlay: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#ffffffee',
    borderRadius: 16, padding: 10, alignItems: 'center',
    borderWidth: 2, elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    minWidth: 90,
  },
  indexOverlayTitle: { fontSize: 9,  color: '#555', fontWeight: '600', marginBottom: 2 },
  indexOverlayScore: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  indexOverlayLabel: { fontSize: 10, fontWeight: '700' },

  bottomCard:    { 
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    elevation: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -5 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 10 
  },
  dragHandleArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
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
  bottomContent: { padding: 16, paddingBottom: 60 },

  metricsRow:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricPill:  { flex: 1, alignItems: 'center', backgroundColor: '#F1F8E9', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: '#C8E6C9' },
  metricPillAlert: { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' },
  metricIcon:  { fontSize: 14 },
  metricLabel: { fontSize: 9, color: '#888', marginTop: 2 },
  metricValue: { fontSize: 11, fontWeight: '700', color: '#2E7D32', marginTop: 2, textAlign: 'center' },
  metricValueAlert: { color: '#E65100' },

  zoneCard:       { backgroundColor: '#F9FBE7', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#DCEDC8' },
  zoneCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneEmoji:      { fontSize: 28 },
  zoneCropLabel:  { fontSize: 16, fontWeight: '700', color: '#1B5E20' },
  zoneProvinceLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  zoneAreaBadge:  { backgroundColor: '#C8E6C9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  zoneAreaText:   { fontSize: 12, color: '#1B5E20', fontWeight: '700' },

  section:      { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginBottom: 8 },

  warningItem: { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginBottom: 6, borderLeftWidth: 4, borderLeftColor: '#FF6D00' },
  warningText: { fontSize: 13, color: '#BF360C' },
  tipItem:     { backgroundColor: '#F1F8E9', borderRadius: 10, padding: 10, marginBottom: 6, borderLeftWidth: 4, borderLeftColor: '#43A047' },
  tipText:     { fontSize: 13, color: '#1B5E20' },

  barRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { fontSize: 12, color: '#555', width: 130 },
  barTrack: { flex: 1, height: 10, backgroundColor: '#E8F5E9', borderRadius: 5, overflow: 'hidden' },
  barFill:  { height: 10, borderRadius: 5 },
  barScore: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' },

  totalScoreRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: '#F9FBE7', borderWidth: 2 },
  totalScoreLabel:{ fontSize: 14, fontWeight: '700', color: '#333' },
  totalScoreValue:{ fontSize: 14, fontWeight: '800' },

  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: (SCREEN_WIDTH - 64) / 2 },
  legendDot:  { width: 14, height: 14, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#444' },

  sourceNote: { fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 8, lineHeight: 16 },
});