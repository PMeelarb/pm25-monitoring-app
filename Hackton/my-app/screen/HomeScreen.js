import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, ImageBackground, Modal
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ForecastCard from '../component/ForecastCard';
import { AppContext } from '../context/AppContext';

// ─── ฟังก์ชันคืนสีและข้อความตามค่า PM2.5 ───────────────────────────────────
const getPM25Details = (value) => {
  if (value <= 25) return { color: '#29B6F6', text: 'อากาศดีมาก' };
  if (value <= 37) return { color: '#66BB6A', text: 'อากาศดี' };
  if (value <= 50) return { color: '#FFCA28', text: 'ปานกลาง' };
  if (value <= 90) return { color: '#FFA726', text: 'เริ่มมีผลกระทบ' };
  return { color: '#EF5350', text: 'มีผลกระทบ' };
};

// ─── ปัจจัยพยากรณ์ (static ตาม design) ─────────────────────────────────────
const FACTORS = [
  { name: 'PM10',        pct: 42, color: '#E24B4A' },
  { name: 'ความเร็วลม', pct: 24, color: '#378ADD' },
  { name: 'อุณหภูมิ',   pct: 18, color: '#EF9F27' },
  { name: 'ความชื้น',   pct: 10, color: '#1D9E75' },
  { name: 'NO2',         pct: 6,  color: '#7F77DD' },
];

// ─── สร้างข้อความ Insight จาก forecast จริง ─────────────────────────────────
const getInsightText = (forecast, weatherData) => {
  if (!forecast || forecast.length < 3) return 'กำลังวิเคราะห์ข้อมูล...';

  const vals = forecast.map(f => parseFloat(f.value) || 0);
  const avg3  = (vals.slice(0, 3).reduce((a, b) => a + b, 0) / 3).toFixed(1);
  const max7  = Math.max(...vals);
  const maxDay = forecast[vals.indexOf(max7)]?.day || '';
  const wind  = parseFloat(weatherData?.wind) || 0;

  if (max7 > 50) {
    return `มีแนวโน้ม PM2.5 เพิ่มขึ้นสูงสุดในวัน${maxDay} (${Math.round(max7)} µg/m³) ควรลดกิจกรรมกลางแจ้งและสวมหน้ากากอนามัย`;
  }
  if (avg3 <= 37 && wind >= 10) {
    return `คาดว่าคุณภาพอากาศจะอยู่ในระดับดีตลอด 3 วันข้างหน้า เนื่องจากความเร็วลม ${Math.round(wind)} km/h อยู่ในเกณฑ์สูงและอุณหภูมิค่อนข้างคงที่`;
  }
  if (avg3 <= 50) {
    return `คุณภาพอากาศอยู่ในระดับปานกลางโดยเฉลี่ย ${avg3} µg/m³ ควรติดตามค่า PM2.5 อย่างต่อเนื่องในช่วง 3 วันข้างหน้า`;
  }
  return `ค่า PM2.5 เฉลี่ย 3 วันอยู่ที่ ${avg3} µg/m³ อยู่ในระดับที่เริ่มมีผลกระทบ แนะนำให้ระวังสุขภาพและลดเวลาอยู่กลางแจ้ง`;
};

// ─── badge label และสี ───────────────────────────────────────────────────────
const getInsightBadge = (forecast) => {
  if (!forecast || forecast.length === 0) return { label: 'กำลังวิเคราะห์', bg: '#EDF2F7', color: '#718096' };
  const avg = forecast.slice(0, 3).reduce((a, f) => a + (parseFloat(f.value) || 0), 0) / 3;
  if (avg <= 37) return { label: 'แนวโน้มดี 3 วัน',       bg: '#E1F5EE', color: '#0F6E56' };
  if (avg <= 50) return { label: 'ระดับปานกลาง',          bg: '#FAEEDA', color: '#854F0B' };
  return            { label: 'ควรระวัง',                   bg: '#FCEBEB', color: '#A32D2D' };
};

const PM25_KNOWLEDGE = [
  {
    id: 1, icon: 'information-circle', lib: 'Ionicons',
    title: 'PM2.5 คืออะไร?', color: '#4A90D9', bgColor: '#EBF4FF',
    content: 'PM2.5 คือ ฝุ่นละอองขนาดเล็กที่มีเส้นผ่านศูนย์กลางไม่เกิน 2.5 ไมโครเมตร (เล็กกว่าเส้นผมมนุษย์ถึง 30 เท่า) สามารถเล็ดลอดผ่านขนจมูกและเข้าสู่ปอด กระแสเลือด และอวัยวะต่างๆ ได้โดยตรง',
  },
  {
    id: 2, icon: 'cloud-outline', lib: 'Ionicons',
    title: 'แหล่งกำเนิดหลักของ PM2.5', color: '#718096', bgColor: '#F7FAFC',
    content: '• การเผาไหม้เชื้อเพลิงยานพาหนะ\n• การเผาในที่โล่ง (เผาฟาง, เผาป่า)\n• โรงงานอุตสาหกรรม\n• การก่อสร้าง\n• ควันบุหรี่\n• การปรุงอาหารที่ใช้ความร้อนสูง',
  },
  {
    id: 3, icon: 'fitness', lib: 'Ionicons',
    title: 'ผลกระทบต่อสุขภาพ', color: '#E53E3E', bgColor: '#FFF5F5',
    content: 'ระยะสั้น: ระคายเคืองตา จมูก คอ ไอ จาม หายใจลำบาก\n\nระยะยาว: โรคหัวใจและหลอดเลือด โรคปอดเรื้อรัง มะเร็งปอด ส่งผลต่อพัฒนาการสมองในเด็ก และอาจทำให้เสียชีวิตก่อนวัยอันควร',
  },
  {
    id: 4, icon: 'shield-checkmark', lib: 'Ionicons',
    title: 'วิธีป้องกันตัวเองที่ดีที่สุด', color: '#38A169', bgColor: '#F0FFF4',
    content: '✅ สวมหน้ากาก N95 หรือ KN95 (ไม่ใช่หน้ากากผ้าธรรมดา)\n✅ ติดตามค่า PM2.5 ก่อนออกจากบ้านทุกวัน\n✅ ปิดประตูหน้าต่างให้มิดชิดเมื่อค่าฝุ่นสูง\n✅ ใช้เครื่องฟอกอากาศในห้อง\n✅ หลีกเลี่ยงบริเวณที่มีการเผาไหม้',
  },
  {
    id: 5, icon: 'stats-chart', lib: 'Ionicons',
    title: 'เกณฑ์มาตรฐานค่า PM2.5', color: '#D69E2E', bgColor: '#FFFFF0',
    content: '🔵 0–25 μg/m³ → ดีมาก (ทำกิจกรรมกลางแจ้งได้ปกติ)\n🟢 26–37 μg/m³ → ดี\n🟡 38–50 μg/m³ → ปานกลาง (กลุ่มเสี่ยงควรระวัง)\n🟠 51–90 μg/m³ → เริ่มมีผลต่อสุขภาพ\n🔴 >90 μg/m³ → มีผลต่อสุขภาพ (ทุกคนควรหลีกเลี่ยง)',
  },
  {
    id: 6, icon: 'home', lib: 'Ionicons',
    title: 'ปรับปรุงคุณภาพอากาศในบ้าน', color: '#805AD5', bgColor: '#FAF5FF',
    content: '🪴 ปลูกต้นไม้ฟอกอากาศ เช่น พลูด่าง, ว่านหางจระเข้\n🌬️ เปิดเครื่องฟอกอากาศตั้งแต่ระดับ HEPA\n🚫 งดสูบบุหรี่ในบ้าน\n🧹 ดูดฝุ่นและเช็ดพื้นบ่อยๆ\n🪟 เปลี่ยนฟิลเตอร์แอร์ทุก 3–6 เดือน',
  },
];

const KnowledgeCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded(!expanded)}
      style={[styles.knowledgeCard, { borderLeftColor: item.color }]}
    >
      <View style={styles.knowledgeHeader}>
        <View style={[styles.knowledgeIconBox, { backgroundColor: item.bgColor }]}>
          {item.lib === 'Ionicons'
            ? <Ionicons name={item.icon} size={26} color={item.color} />
            : <MaterialCommunityIcons name={item.icon} size={26} color={item.color} />}
        </View>
        <Text style={styles.knowledgeTitle}>{item.title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#A0AEC0" />
      </View>
      {expanded && (
        <View style={styles.knowledgeBody}>
          <Text style={styles.knowledgeContent}>{item.content}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { isPremium } = useContext(AppContext);
  const [isLoading,         setIsLoading]         = useState(true);
  const [locationName,      setLocationName]       = useState('กำลังค้นหาตำแหน่ง...');
  
  const [airData,           setAirData]            = useState({ pm25: 0, aqi: '--', stationName: '', province: '' , time: '--:--' });
  const [weatherData,       setWeatherData]        = useState({ temp: '--', humidity: '--', wind: '--' });
  const [forecastList,      setForecastList]       = useState([]);
  const [showForecastModal, setShowForecastModal]  = useState(false);
  const [showFactors,       setShowFactors]        = useState(false);

  // ─── ฟังก์ชันระยะทาง ─────────────────────────────────────────────────────
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ─── 1. Air4Thai ─────────────────────────────────────────────────────────
  const fetchAir4ThaiCurrent = async (userLat, userLon) => {
    try {
      const response = await fetch('http://air4thai.com/forweb/getAQI_JSON.php');
      const data = await response.json();
      const stations = data.stations || [];
      if (stations.length === 0) return null;

      let closest = stations[0];
      let minDist = getDistanceFromLatLonInKm(userLat, userLon, parseFloat(closest.lat), parseFloat(closest.long));
      for (let i = 1; i < stations.length; i++) {
        const d = getDistanceFromLatLonInKm(userLat, userLon, parseFloat(stations[i].lat), parseFloat(stations[i].long));
        if (d < minDist) { minDist = d; closest = stations[i]; }
      }

      let pm25Val = 0, aqiVal = '--', timeVal = '--:--';
      
      if (closest.AQILast) {
        if (closest.AQILast.PM25?.value !== '-') pm25Val = parseFloat(closest.AQILast.PM25?.value || 0);
        
        const aqiObj = closest.AQILast?.AQI;
        if (aqiObj) {
          const raw = aqiObj.aqi ?? aqiObj.value ?? aqiObj.AQI ?? null;
          if (raw !== null && String(raw) !== '-') aqiVal = String(raw);
        }
        
        if (closest.AQILast.time) {
          timeVal = closest.AQILast.time.substring(0, 5); 
        }
      }

      const displayName = closest.nameTH || closest.nameTh || closest.nameEn || closest.areaTH || closest.areaTh || 'ไม่ทราบชื่อสถานี';
      const provinceRaw = closest.areaTH || closest.areaTh || '';
      const province = provinceRaw.split(' ').pop();

      return { stationName: displayName, province, pm25: pm25Val, aqi: aqiVal, time: timeVal };
    } catch (e) { console.error('Air4Thai Error:', e); return null; }
  };

  // ─── 2. สภาพอากาศ ────────────────────────────────────────────────────────
  const fetchWeather = async (lat, lon) => {
    try {
      const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=Asia/Bangkok`);
      const json = await res.json();
      return {
        temp:     Math.round(json.current?.temperature_2m      || 0),
        humidity: Math.round(json.current?.relative_humidity_2m || 0),
        wind:     Math.round(json.current?.wind_speed_10m       || 0),
      };
    } catch (e) { console.error('Weather Error:', e); return null; }
  };

  // ─── 3. พยากรณ์ 7 วัน ───────────────────────────────────────────────────
  const fetchAirQualityForecast = async (lat, lon) => {
    try {
      const res  = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5&timezone=Asia/Bangkok&forecast_days=7`);
      const json = await res.json();

      const times = json.hourly?.time   || [];
      const pm25s = json.hourly?.pm2_5  || [];

      const dailyMap = {};
      times.forEach((t, i) => {
        const date = t.split('T')[0];
        const val  = pm25s[i];
        if (val !== null && val !== undefined) {
          if (!dailyMap[date]) dailyMap[date] = [];
          dailyMap[date].push(val);
        }
      });

      const daysTH   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
      const monthsTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

      return Object.keys(dailyMap).slice(0, 7).map((dateStr, index) => {
        const [year, month, day] = dateStr.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        let dayLabel = daysTH[dateObj.getDay()];
        if (index === 0) dayLabel = 'วันนี้';
        if (index === 1) dayLabel = 'พรุ่งนี้';

        const sumPm25 = dailyMap[dateStr].reduce((a, b) => a + b, 0);
        const avgPm25  = Math.round(sumPm25 / dailyMap[dateStr].length);
        const details  = getPM25Details(avgPm25);

        return {
          id: String(index),
          day: dayLabel,
          date: `${parseInt(day)} ${monthsTH[parseInt(month) - 1]}`,
          value: String(avgPm25),
          color: details.color,
          statusText: details.text,
        };
      });
    } catch (e) { console.error('Forecast Error:', e); return []; }
  };

  // ─── useEffect ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationName('กรุณาเปิดสิทธิ์ Location');
          setIsLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo.length > 0) setLocationName(geo[0].province || 'นครราชสีมา');

        const [airResult, weatherResult, forecastResult] = await Promise.all([
          fetchAir4ThaiCurrent(latitude, longitude),
          fetchWeather(latitude, longitude),
          fetchAirQualityForecast(latitude, longitude),
        ]);

        if (airResult)                  setAirData(airResult);
        if (weatherResult)              setWeatherData(weatherResult);
        if (forecastResult?.length > 0) setForecastList(forecastResult);
        else setForecastList([{ id: '99', day: 'พยากรณ์', date: 'รออัปเดต', value: '--', color: '#A0AEC0', statusText: 'รออัปเดต' }]);

      } catch (err) {
        console.error('Main Effect Error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── Gauge ────────────────────────────────────────────────────────────────
  const maxPM25         = 200;
  const fillPercentage  = Math.min(airData.pm25 / maxPM25, 1);
  const radius          = 95;
  const arcLength       = Math.PI * radius;
  const strokeDashoffset = arcLength - arcLength * fillPercentage;
  const status          = getPM25Details(airData.pm25);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#01579B" />
        <Text style={styles.loadingText}>กำลังเตรียมข้อมูลพื้นที่ของคุณ...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <ImageBackground
        source={{ uri: 'https://sut-website.sut.weon.website/wp-content/uploads/2024/12/DSC02078-2-scaled.jpg' }}
        style={styles.headerBackground}
        imageStyle={styles.headerBackgroundImage}
      >
        <View style={styles.headerOverlay} />

        <View style={styles.headerContent}>
          <Text style={styles.title}>{airData.province || locationName}</Text>
          <Text style={styles.subtitle}>📍 ใกล้ที่สุด: {airData.stationName}</Text>
          <Text style={styles.timeSubtitle}>🕒 อัปเดตล่าสุด {airData.time} น.</Text>

          <View style={styles.gaugeWrapper}>
            <Svg width="220" height="120">
              <Path d="M 15 110 A 95 95 0 0 1 205 110" stroke="rgba(255,255,255,0.15)" strokeWidth="20" fill="none" strokeLinecap="round" />
              <Path d="M 15 110 A 95 95 0 0 1 205 110" stroke={status.color} strokeWidth="20" fill="none" strokeLinecap="round" strokeDasharray={arcLength} strokeDashoffset={strokeDashoffset} />
            </Svg>
            <View style={styles.gaugeTextContainer}>
              <Text style={styles.gaugeText}>{airData.pm25}</Text>
              <Text style={styles.unitText}>PM2.5 (µg/m³)</Text>
            </View>
          </View>

          <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          <Text style={styles.aqiText}>AQI : {airData.aqi}</Text>
          <Text style={styles.sourceText}>*ข้อมูลปัจจุบันอ้างอิง: Air4Thai (กรมควบคุมมลพิษ)</Text>
        </View>
      </ImageBackground>

      {/* ── Weather Row ── */}
      <View style={[styles.weatherRow, isPremium && styles.premiumWeatherRow]}>
        {isPremium && (
          <View style={styles.premiumLabelBadge}>
            <Text style={styles.premiumLabelText}>พรีเมี่ยม</Text>
          </View>
        )}

        <View style={styles.weatherItem}>
          <Text style={styles.weatherLabel}>🌡️ อุณหภูมิ</Text>
          <Text style={styles.weatherValue}>{weatherData.temp}°C</Text>
        </View>
        <View style={[styles.weatherItem, styles.weatherItemBorder]}>
          <Text style={styles.weatherLabel}>💧 ความชื้น</Text>
          <Text style={styles.weatherValue}>{weatherData.humidity}%</Text>
        </View>
        <View style={styles.weatherItem}>
          <Text style={styles.weatherLabel}>💨 ลม</Text>
          <Text style={styles.weatherValue}>{weatherData.wind} km/h</Text>
        </View>
      </View>
      <Text style={styles.weatherSourceText}>*สภาพอากาศปัจจุบันโดย: Open-Meteo</Text>

      {/* ── Forecast ── */}
      <View style={styles.forecastSection}>
        <View style={styles.forecastHeader}>
          <Text style={styles.forecastTitle}>พยากรณ์ 7 วันข้างหน้า</Text>
          <TouchableOpacity onPress={() => setShowForecastModal(true)}>
            <Text style={styles.seeAllBtn}>ดูทั้งหมด {'>'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          {forecastList.map((item) => (
            <ForecastCard key={item.id} day={item.day} date={item.date} value={item.value} color={item.color} statusText={item.statusText} />
          ))}
        </ScrollView>
        <Text style={styles.weatherSourceText}>*ข้อมูลพยากรณ์คำนวณเชิงสถิติโดย: Open-Meteo Air Quality</Text>
      </View>

      {/* 🟢 Factors Accordion Card ── */}
      <View style={styles.factorsCard}>
        <TouchableOpacity
          style={styles.factorsToggleBtn}
          onPress={() => setShowFactors(!showFactors)}
          activeOpacity={0.7}
        >
          <View style={styles.factorsToggleLeft}>
            <View style={styles.factorIconBox}>
              <Ionicons name="bar-chart-outline" size={18} color="#185FA5" />
            </View>
            <Text style={styles.factorsToggleText}>ปัจจัยที่มีผลต่อการพยากรณ์</Text>
          </View>
          <Ionicons name={showFactors ? 'chevron-up' : 'chevron-down'} size={20} color="#A0AEC0" />
        </TouchableOpacity>

        {showFactors && (
          <View style={styles.factorsContainer}>
            <View style={styles.insightDivider} />
            <Text style={styles.factorsHeader}>📈 ปัจจัยสำคัญวันนี้</Text>
            {FACTORS.map((f, i) => (
              <View key={i} style={styles.factorRow}>
                <Text style={styles.factorRank}>{i + 1}</Text>
                <Text style={styles.factorName}>{f.name}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${f.pct}%`, backgroundColor: f.color }]} />
                </View>
                <Text style={[styles.factorPct, { color: f.color }]}>{f.pct}%</Text>
              </View>
            ))}
            <Text style={[styles.weatherSourceText, { marginTop: 15 }]}>*Open-Meteo Air Quality</Text>
          </View>
        )}
      </View>

      {/* ── ส่วนความรู้ PM2.5 (ย้ายมาจากหน้าฉัน) ── */}
      <View style={styles.knowledgeSection}>
        <Text style={styles.sectionHeaderTitle}>📚 ความรู้เบื้องต้นเกี่ยวกับ PM2.5</Text>
        {PM25_KNOWLEDGE.map(item => <KnowledgeCard key={item.id} item={item} />)}
      </View>

      {/* ── Modal Forecast ── */}
      <Modal visible={showForecastModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>พยากรณ์คุณภาพอากาศ 7 วัน</Text>
              <TouchableOpacity onPress={() => setShowForecastModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#4A5568" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>📍 {airData.stationName}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              {forecastList.map((item) => (
                <View key={item.id} style={styles.modalRow}>
                  <View style={styles.modalDayCol}>
                    <Text style={styles.modalDayText}>{item.day}</Text>
                    <Text style={styles.modalDateText}>{item.date}</Text>
                  </View>
                  <View style={styles.modalBarContainer}>
                    <View style={[
                      styles.modalBar,
                      { width: `${Math.min((parseFloat(item.value) || 0) / 150 * 100, 100)}%`, backgroundColor: item.color }
                    ]} />
                  </View>
                  <View style={styles.modalValueCol}>
                    <Text style={[styles.modalValueText, { color: item.color }]}>
                      {item.value} <Text style={{ fontSize: 10, color: '#A0AEC0' }}>µg/m³</Text>
                    </Text>
                    <Text style={styles.modalStatusText}>{item.statusText}</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.modalSourceText}>*ข้อมูลพยากรณ์โดย: Open-Meteo Air Quality</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F5F7FA' },
  loadingContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  loadingText:        { marginTop: 15, fontSize: 14, color: '#555', fontWeight: '500' },

  // Header
  headerBackground:      { width: '100%', borderBottomLeftRadius: 45, borderBottomRightRadius: 45, overflow: 'hidden' },
  headerBackgroundImage: { resizeMode: 'cover' },
  headerOverlay:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
  headerContent:         { paddingTop: 60, paddingBottom: 80, alignItems: 'center' },
  title:                 { color: 'white', fontSize: 26, fontWeight: 'bold' },
  subtitle:              { color: 'rgba(255,255,255,0.9)', marginTop: 5, fontSize: 14 },
  timeSubtitle:          { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  sourceText:            { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 15 },
  weatherSourceText:     { color: '#A0AEC0', fontSize: 10, textAlign: 'center', marginTop: 10 },

  // Gauge
  gaugeWrapper:       { alignItems: 'center', justifyContent: 'flex-end', marginVertical: 25, width: 220, height: 120 },
  gaugeTextContainer: { position: 'absolute', bottom: -30, alignItems: 'center', width: '100%' },
  gaugeText:          { color: 'white', fontSize: 60, fontWeight: '900', lineHeight: 65, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  unitText:           { color: 'white', fontSize: 13, fontWeight: '600', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  statusText:         { fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  aqiText:            { color: 'white', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, fontSize: 14, fontWeight: '700' },

  // Weather row
  weatherRow: {
    flexDirection: 'row', justifyContent: 'space-around', padding: 20,
    backgroundColor: 'white', marginHorizontal: 20, marginTop: -30,
    borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
    position: 'relative', // ✨ เติมบรรทัดนี้เพื่อให้ Absolute Badge ยึดกับขอบกล่องแม่ได้ถูกต้องครับ
  },
  weatherItem:       { flex: 1, alignItems: 'center' },
  weatherItemBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#EDF2F7' },
  weatherLabel:      { color: 'gray', marginBottom: 5, fontSize: 12 },
  weatherValue:      { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },

  // Forecast section
  forecastSection: { paddingLeft: 20, paddingVertical: 25 },
  forecastHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingRight: 20 },
  forecastTitle:   { fontSize: 16, fontWeight: 'bold', color: '#333' },
  seeAllBtn:       { color: '#2C5282', fontSize: 14, fontWeight: 'bold' },

  // Factors Card
  factorsCard: {
    marginHorizontal: 20, marginBottom: 30,
    backgroundColor: 'white', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  factorsToggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
  },
  factorsToggleLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  factorIconBox: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#E6F1FB',
    alignItems: 'center', justifyContent: 'center'
  },
  factorsToggleText: {
    fontSize: 14, fontWeight: '600', color: '#2D3748'
  },
  factorsContainer: {
    paddingHorizontal: 16, paddingBottom: 16,
  },
  insightDivider: { height: 1, backgroundColor: '#EDF2F7', marginBottom: 16 },
  factorsHeader:    { fontSize: 13, fontWeight: '600', color: '#2D3748', marginBottom: 14 },
  factorRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  factorRank:       { width: 16, fontSize: 12, color: '#A0AEC0', textAlign: 'right' },
  factorName:       { width: 85, fontSize: 12, color: '#4A5568' },
  barTrack:         { flex: 1, height: 8, backgroundColor: '#EDF2F7', borderRadius: 20, overflow: 'hidden' },
  barFill:          { height: '100%', borderRadius: 20 },
  factorPct:        { width: 34, fontSize: 12, fontWeight: '600', textAlign: 'right' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle:    { fontSize: 17, fontWeight: 'bold', color: '#2D3748' },
  modalCloseBtn: { backgroundColor: '#EDF2F7', padding: 6, borderRadius: 20 },
  modalSubtitle: { fontSize: 12, color: '#718096', marginBottom: 4 },

  modalRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalDayCol:       { width: 72 },
  modalDayText:      { fontSize: 14, fontWeight: 'bold', color: '#2D3748' },
  modalDateText:     { fontSize: 11, color: '#A0AEC0', marginTop: 2 },
  modalBarContainer: { flex: 1, height: 10, backgroundColor: '#EDF2F7', borderRadius: 6, overflow: 'hidden', marginHorizontal: 10 },
  modalBar:          { height: '100%', borderRadius: 6 },
  modalValueCol:     { width: 80, alignItems: 'flex-end' },
  modalValueText:    { fontSize: 16, fontWeight: 'bold' },
  modalStatusText:   { fontSize: 10, color: '#718096', marginTop: 2, textAlign: 'right' },
  modalSourceText:   { color: '#A0AEC0', fontSize: 10, textAlign: 'center', marginTop: 16, marginBottom: 20 },

  // สไตล์ Premium และกล่องข้อมูลความรู้
  premiumWeatherRow: {
    borderWidth: 1.5,
    borderColor: '#D4AF37', 
  },
  premiumLabelBadge: {
    position: 'absolute',
    top: -11, 
    alignSelf: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 14,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4AF37',
    zIndex: 5,
  },
  premiumLabelText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  knowledgeSection: { 
    paddingHorizontal: 20, 
    marginTop: 10,
    marginBottom: 20 
  },
  sectionHeaderTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#2D3748', 
    marginBottom: 15 
  },
  knowledgeCard: { 
    backgroundColor: 'white', 
    borderRadius: 14, 
    padding: 16, 
    marginBottom: 12, 
    borderLeftWidth: 5, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3
  },
  knowledgeHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  knowledgeIconBox: { 
    width: 42, 
    height: 42, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  knowledgeTitle: { 
    flex: 1, 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#2D3748' 
  },
  knowledgeBody: { 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F0F0F0' 
  },
  knowledgeContent: { 
    fontSize: 14, 
    color: '#4A5568', 
    lineHeight: 24 
  },
});