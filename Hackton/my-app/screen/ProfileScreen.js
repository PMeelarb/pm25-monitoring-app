import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// 🌟 นำเข้า Context เพื่อใช้สถานะระบบสมาชิก
import { AppContext } from '../context/AppContext'; 

// ============================================================
// ข้อมูลความรู้ PM2.5
// ============================================================
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

// ============================================================
// KnowledgeCard (accordion)
// ============================================================
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
            ? <Ionicons name={item.icon} size={22} color={item.color} />
            : <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />}
        </View>
        <Text style={styles.knowledgeTitle}>{item.title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#A0AEC0" />
      </View>
      {expanded && (
        <View style={styles.knowledgeBody}>
          <Text style={styles.knowledgeContent}>{item.content}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================================================
// ฟังก์ชันสร้างคำแนะนำ — อิงจากระดับคุณภาพอากาศแยกตามกลุ่ม
// ============================================================
const getRecommendations = (statusLevel, group, temp, humidity) => {
  const advice = [];

  // ─── ระดับดัชนีอากาศที่ประเมินมาแล้ว ───────────────────────────
  const dustOk      = statusLevel === 'ok' || statusLevel === 'good';
  const dustMid     = statusLevel === 'mid';
  const dustHigh    = statusLevel === 'high';
  const dustDanger  = statusLevel === 'danger';

  // ─── อุณหภูมิ ─────────────────────────────────────────────
  const tempHot     = temp !== null && temp > 35;
  const tempCool    = temp !== null && temp < 20;

  // ─── ความชื้น ─────────────────────────────────────────────
  const humHigh     = humidity !== null && humidity > 80;
  const humLow      = humidity !== null && humidity < 40;

  // ─── คำแนะนำฝุ่น ตามกลุ่ม ─────────────────────────────────
  if (dustDanger) {
    advice.push({ icon: 'home', lib: 'Ionicons', color: '#C53030',
      title: '⛔ ห้ามออกนอกบ้านโดยเด็ดขาด',
      desc: group === 'patient'
        ? 'ผู้ป่วยโรคหัวใจ ปอด หรือหอบหืด มีความเสี่ยงสูงมาก ควรอยู่ในห้องปิดและเปิดเครื่องฟอกอากาศ'
        : group === 'elderly'
        ? 'ผู้สูงอายุระบบภูมิคุ้มกันอ่อนแอ ควรอยู่ในอาคารที่ปิดสนิท ห้ามออกไปสัมผัสอากาศภายนอก'
        : group === 'outdoor'
        ? 'ค่ามลพิษอันตรายมาก หากจำเป็นต้องออกไป ต้องสวม N95 และจำกัดเวลาภายนอกไม่เกิน 15 นาที'
        : 'ค่ามลพิษอันตรายต่อทุกคน ควรอยู่ในบ้านและหลีกเลี่ยงกิจกรรมกลางแจ้งทุกชนิด',
    });
    advice.push({ icon: 'air-purifier', lib: 'MaterialCommunityIcons', color: '#C53030',
      title: 'เปิดเครื่องฟอกอากาศทันที',
      desc: 'เปิดเครื่องฟอกอากาศ (HEPA filter) ในทุกห้องที่อาศัยอยู่ และปิดประตูหน้าต่างให้สนิท',
    });
  } else if (dustHigh) {
    if (group === 'outdoor') {
      advice.push({ icon: 'face-mask', lib: 'MaterialCommunityIcons', color: '#C05621',
        title: 'สวมหน้ากาก N95 ตลอดเวลา',
        desc: 'ผู้ที่ต้องทำงานกลางแจ้ง ต้องสวม N95 ไม่ใช่หน้ากากผ้า และเปลี่ยนทุก 4–8 ชั่วโมง',
      });
      advice.push({ icon: 'timer-outline', lib: 'MaterialCommunityIcons', color: '#C05621',
        title: 'จำกัดเวลากลางแจ้ง — สลับพักในร่ม',
        desc: 'ทำงานกลางแจ้งได้ไม่เกินครั้งละ 45 นาที แล้วเข้ามาพักในที่ร่มอย่างน้อย 15 นาที',
      });
      advice.push({ icon: 'eye-outline', lib: 'Ionicons', color: '#744210',
        title: 'ใส่แว่นตากันฝุ่น',
        desc: 'ป้องกันฝุ่นเข้าตา ซึ่งอาจทำให้ระคายเคืองและติดเชื้อได้ง่าย',
      });
    } else if (group === 'elderly') {
      advice.push({ icon: 'home', lib: 'Ionicons', color: '#C05621',
        title: 'งดกิจกรรมกลางแจ้งทั้งหมด',
        desc: 'ผู้สูงอายุควรอยู่ในบ้าน หลีกเลี่ยงแม้แต่การเดินออกกำลังในสวน',
      });
      advice.push({ icon: 'window-closed', lib: 'MaterialCommunityIcons', color: '#C05621',
        title: 'ปิดหน้าต่างและประตูให้สนิท',
        desc: 'ฝุ่นสามารถลอดเข้าช่องแอร์หรือรอยแตกได้ ควรติดซีลกันฝุ่นหากทำได้',
      });
    } else if (group === 'patient') {
      advice.push({ icon: 'medical-bag', lib: 'MaterialCommunityIcons', color: '#C05621',
        title: 'เตรียมยาฉุกเฉินให้พร้อม',
        desc: 'ผู้ป่วยหอบหืด/ภูมิแพ้ ควรพกยาพ่นติดตัวตลอด และแจ้งคนในบ้านทราบด้วย',
      });
      advice.push({ icon: 'hospital', lib: 'MaterialCommunityIcons', color: '#C05621',
        title: 'หากมีอาการผิดปกติรีบพบแพทย์',
        desc: 'แน่นหน้าอก หายใจลำบาก ไอมาก หรือใจสั่น ให้ไปโรงพยาบาลทันที ไม่ควรรอ',
      });
    } else {
      advice.push({ icon: 'walk', lib: 'Ionicons', color: '#C05621',
        title: 'ลดกิจกรรมกลางแจ้ง',
        desc: 'หากออกไปข้างนอก ควรสวม N95 และใช้เวลาให้สั้นที่สุด',
      });
      advice.push({ icon: 'face-mask', lib: 'MaterialCommunityIcons', color: '#C05621',
        title: 'สวมหน้ากาก N95 ก่อนออกจากบ้าน',
        desc: 'หน้ากากผ้าหรือหน้ากากอนามัยธรรมดาไม่สามารถกรอง PM2.5 ได้',
      });
    }
  } else if (dustMid) {
    if (group === 'patient' || group === 'elderly') {
      advice.push({ icon: 'face-mask', lib: 'MaterialCommunityIcons', color: '#744210',
        title: 'สวมหน้ากากหากต้องออกนอกบ้าน',
        desc: group === 'patient'
          ? 'กลุ่มเสี่ยงควรป้องกันตัวเองแม้ดัชนีอากาศยังไม่สูงมาก'
          : 'ผู้สูงอายุควรระมัดระวังเป็นพิเศษแม้ดัชนีอากาศอยู่ระดับปานกลาง',
      });
      advice.push({ icon: 'timer-outline', lib: 'MaterialCommunityIcons', color: '#744210',
        title: 'จำกัดเวลาทำกิจกรรมกลางแจ้ง',
        desc: 'ไม่ควรออกกำลังกายกลางแจ้งนานเกิน 30 นาทีในสภาพอากาศนี้',
      });
    } else {
      advice.push({ icon: 'walk', lib: 'Ionicons', color: '#744210',
        title: 'ทำกิจกรรมกลางแจ้งได้ แต่ระวัง',
        desc: 'ค่าอากาศปานกลาง ยังออกกำลังกายได้ แต่ควรหลีกเลี่ยงพื้นที่จราจรหนาแน่น',
      });
    }
  } else {
    // dustOk
    advice.push({ icon: 'leaf', lib: 'Ionicons', color: '#276749',
      title: '✅ อากาศดี — ทำกิจกรรมได้ตามปกติ',
      desc: group === 'outdoor'
        ? 'วันนี้เหมาะมากสำหรับทำงานกลางแจ้ง คุณภาพอากาศดี ไม่จำเป็นต้องสวมหน้ากาก'
        : group === 'elderly'
        ? 'วันนี้อากาศดี ผู้สูงอายุสามารถออกเดินหรือออกกำลังเบาๆ กลางแจ้งได้'
        : group === 'patient'
        ? 'อากาศดีวันนี้ แต่ผู้ป่วยควรยังคงพกยาติดตัวไว้เป็นนิสัย'
        : 'เหมาะสำหรับทุกกิจกรรมกลางแจ้ง รวมถึงออกกำลังกาย',
    });
    advice.push({ icon: 'window-open', lib: 'MaterialCommunityIcons', color: '#276749',
      title: 'เปิดหน้าต่างระบายอากาศ',
      desc: 'ให้อากาศบริสุทธิ์ถ่ายเทเข้าบ้าน ช่วยลดสารก่อภูมิแพ้ที่สะสมในบ้านได้',
    });
  }

  // ─── คำแนะนำเพิ่มเติมจากอุณหภูมิ ──────────────────────────
  if (tempHot) {
    advice.push({ icon: 'thermometer-high', lib: 'MaterialCommunityIcons', color: '#9B2C2C',
      title: `🌡 อากาศร้อนจัด (${temp}°C) — ระวังโรคลมแดด`,
      desc: group === 'outdoor'
        ? 'ดื่มน้ำทุก 20–30 นาที สวมเสื้อสีอ่อน และหลีกเลี่ยงทำงานกลางแดดช่วง 11:00–15:00'
        : group === 'elderly'
        ? 'ผู้สูงอายุเสี่ยง Heat Stroke สูง ควรอยู่ในห้องแอร์ช่วงกลางวัน'
        : 'ดื่มน้ำให้เพียงพอ และหลีกเลี่ยงออกกำลังกายหนักกลางแจ้งในช่วงเที่ยงวัน',
    });
  } else if (tempCool) {
    advice.push({ icon: 'thermometer-low', lib: 'MaterialCommunityIcons', color: '#2B6CB0',
      title: `🧥 อากาศเย็น (${temp}°C) — แต่งกายให้อบอุ่น`,
      desc: group === 'elderly'
        ? 'ผู้สูงอายุควรสวมเสื้อผ้าหลายชั้น และระวังโรคหัวใจที่อาจกำเริบในอากาศเย็น'
        : group === 'patient'
        ? 'อากาศเย็นอาจกระตุ้นอาการหอบหืด ควรมีผ้าพันคอหรือหน้ากากกันความเย็น'
        : 'แต่งกายให้อบอุ่น โดยเฉพาะถ้าต้องออกไปตอนเช้ามืดหรือค่ำ',
    });
  }

  // ─── คำแนะนำเพิ่มเติมจากความชื้น ──────────────────────────
  if (humHigh && (dustHigh || dustDanger)) {
    advice.push({ icon: 'water', lib: 'Ionicons', color: '#2B6CB0',
      title: `💧 ความชื้นสูง (${humidity}%) + มลพิษสูง`,
      desc: 'ความชื้นสูงทำให้ฝุ่นเกาะติดผิวหนังและทางเดินหายใจมากขึ้น ควรอาบน้ำหลังกลับเข้าบ้านและเปลี่ยนเสื้อผ้าทันที',
    });
  } else if (humLow && (dustHigh || dustDanger)) {
    advice.push({ icon: 'water-off', lib: 'MaterialCommunityIcons', color: '#975A16',
      title: `🏜 อากาศแห้ง (${humidity}%) — มลพิษฟุ้งได้ง่ายขึ้น`,
      desc: 'ความชื้นต่ำทำให้ฝุ่นล่องลอยในอากาศนานขึ้น ควรดื่มน้ำมากๆ และใช้เครื่องเพิ่มความชื้นในห้อง',
    });
  }

  return advice;
};

// ============================================================
// Main Screen
// ============================================================
export default function ProfileScreen({ navigation }) {
  
  // 🌟 เรียกใช้งาน Global State ของระบบสมาชิก
  const { isRegistered, setIsRegistered, isPremium, setIsPremium } = useContext(AppContext);
  const [phoneInput, setPhoneInput] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [userGroup, setUserGroup]       = useState('general');
  const [airData, setAirData]           = useState({ pm25: 0, aqi: 0, time: '--:--' });
  const [displayMode, setDisplayMode]   = useState('PM2.5'); // State หลักสำหรับสลับโหมดการดู
  const [weather, setWeather]           = useState({ temp: null, humidity: null }); // แก้ไขบั๊กบรรทัดที่ถูก Comment บดบัง
  const [locationName, setLocationName] = useState('กำลังค้นหาตำแหน่ง...');
  const [isLoading, setIsLoading]       = useState(true);
  const [activeTab, setActiveTab]       = useState('advice');

  // ─── helpers ─────────────────────────────────────────────
  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchAirData = async (lat, lon) => {
    try {
      const res  = await fetch('http://air4thai.com/forweb/getAQI_JSON.php');
      const data = await res.json();
      const stations = data.stations || [];
      if (!stations.length) return { pm25: 0, aqi: 0, time: '--:--' };

      let best = stations[0], minD = getDistanceKm(lat, lon, parseFloat(best.lat), parseFloat(best.long));
      stations.forEach(s => {
        const d = getDistanceKm(lat, lon, parseFloat(s.lat), parseFloat(s.long));
        if (d < minD) { minD = d; best = s; }
      });

      const pm25 = best.AQILast?.PM25?.value !== '-' ? parseFloat(best.AQILast?.PM25?.value || '0') : 0;
      const aqi = best.AQILast?.AQI?.aqi !== '-' ? parseFloat(best.AQILast?.AQI?.aqi || '0') : 0; 
      return { pm25, aqi, time: best.AQILast?.time || '--:--' };
    } catch { return { pm25: 0, aqi: 0, time: '--:--' }; }
  };

  const fetchWeather = async (lat, lon) => {
    try {
      const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&forecast_days=1&timezone=Asia%2FBangkok`);
      const data = await res.json();
      const hour = new Date().getHours();
      return {
        temp:     data.current_weather?.temperature ?? null,
        humidity: data.hourly?.relativehumidity_2m?.[hour] ?? null,
      };
    } catch { return { temp: null, humidity: null }; }
  };

  // ─── init ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationName('ไม่ได้ระบุตำแหน่ง'); setIsLoading(false); return; }

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo.length > 0) {
          const a = geo[0];
          setLocationName(`📍 ${a.district || a.subregion || a.province || 'ตำแหน่งปัจจุบัน'}`);
        }

        const [air, wx] = await Promise.all([fetchAirData(latitude, longitude), fetchWeather(latitude, longitude)]);
        setAirData(air);
        setWeather(wx);
      } catch (e) {
        console.error(e);
        setLocationName('ค้นหาตำแหน่งไม่สำเร็จ');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleNormalRegister = () => {
    if (phoneInput.length < 10) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
      return;
    }
    setIsRegistered(true);
    Alert.alert('สำเร็จ', 'สมัครสมาชิกเรียบร้อยแล้ว!');
  };

  // ─── การคำนวณสถานะแยกตามโหมด (PM2.5 vs AQI เกณฑ์ประเทศไทย) ───
  const getAirStatus = (value, mode) => {
    if (mode === 'PM2.5') {
      if (value <= 25) return { color: '#29B6F6', text: 'อากาศดีมาก', level: 'ok' };
      if (value <= 37) return { color: '#66BB6A', text: 'อากาศดี', level: 'good' };
      if (value <= 50) return { color: '#FFCA28', text: 'ปานกลาง', level: 'mid' };
      if (value <= 90) return { color: '#FFA726', text: 'เริ่มมีผลกระทบต่อสุขภาพ', level: 'high' };
      return { color: '#EF5350', text: 'มีผลกระทบต่อสุขภาพ', level: 'danger' };
    } else {
      if (value <= 25) return { color: '#29B6F6', text: 'อากาศดีมาก', level: 'ok' };
      if (value <= 50) return { color: '#66BB6A', text: 'อากาศดี', level: 'good' };
      if (value <= 100) return { color: '#FFCA28', text: 'ปานกลาง', level: 'mid' };
      if (value <= 200) return { color: '#FFA726', text: 'เริ่มมีผลกระทบต่อสุขภาพ', level: 'high' };
      return { color: '#EF5350', text: 'มีผลกระทบต่อสุขภาพ', level: 'danger' };
    }
  };

  const currentValue = displayMode === 'PM2.5' ? airData.pm25 : airData.aqi;
  const status = getAirStatus(currentValue, displayMode);
  const recommendations = getRecommendations(status.level, userGroup, weather.temp, weather.humidity);

  const GROUP_CONFIG = [
    { key: 'general', icon: 'account',     label: 'ทั่วไป' },
    { key: 'elderly', icon: 'human-cane',  label: 'ผู้สูงอายุ' },
    { key: 'outdoor', icon: 'hard-hat',    label: 'ทำงานกลางแจ้ง' },
    { key: 'patient', icon: 'medical-bag', label: 'ผู้ป่วย / เสี่ยง' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>คำแนะนำสำหรับคุณ</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2C5282" />
          <Text style={styles.loadingText}>กำลังดึงข้อมูลตำแหน่งและสภาพอากาศ...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* 🌟 ส่วนจัดการระบบสมาชิก */}
          <View style={styles.membershipWrapper}>
            {!isRegistered ? (
              <View style={styles.inlineRegisterBox}>
                <Text style={styles.inlineRegisterTitle}>สมัครสมาชิกเพื่อรับสิทธิพิเศษ</Text>
                <TextInput
                  style={styles.phoneInputInline}
                  placeholder="กรอกเบอร์โทรศัพท์ 10 หลัก"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                />
                <TouchableOpacity style={styles.applyNormalBtn} onPress={handleNormalRegister}>
                  <MaterialCommunityIcons name="account-plus" size={20} color="white" />
                  <Text style={styles.applyNormalText}>ยืนยันการสมัคร</Text>
                </TouchableOpacity>
              </View>
            ) : !isPremium ? (
              <TouchableOpacity 
                style={styles.applyPremiumBtn}
                onPress={() => navigation.navigate('PremiumRegistration')}
              >
                <MaterialCommunityIcons name="crown" size={22} color="white" />
                <Text style={styles.applyPremiumText}>สมัครสมาชิกแบบพรีเมี่ยม (Premium)</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.premiumStatusActive}>
                <MaterialCommunityIcons name="crown" size={22} color="#D4AF37" />
                <Text style={styles.premiumStatusActiveText}>คุณเปิดใช้งานสมาชิกพรีเมี่ยมแล้ว 👑</Text>
              </View>
            )}
          </View>

          {/* ── เลือกกลุ่ม ── */}
          <View style={styles.groupSelectionContainer}>
            <Text style={styles.sectionTitle}>แตะเลือกกลุ่มของคุณ</Text>
            <View style={styles.groupGrid}>
              {GROUP_CONFIG.map(({ key, icon, label }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setUserGroup(key)}
                  style={[styles.groupCard, userGroup === key && styles.activeGroupCard]}
                >
                  <MaterialCommunityIcons name={icon} size={32} color={userGroup === key ? 'white' : '#718096'} />
                  <Text style={[styles.groupCardText, userGroup === key && styles.activeGroupText]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Status Card ── */}
          <View style={[styles.statusCard, { backgroundColor: status.color }]}>
            <View style={styles.statusInfo}>
              
              {/* แถวหัวข้อระบุโหมดชัดเจนพร้อมปุ่มกดสลับค่าดัชนีอากาศ */}
              <View style={styles.modeToggleRow}>
                <Text style={styles.statusLabel}>ดัชนีคุณภาพอากาศ ({displayMode})</Text>
                <TouchableOpacity 
                  style={styles.switchModeBtn}
                  activeOpacity={0.75}
                  onPress={() => setDisplayMode(displayMode === 'PM2.5' ? 'AQI' : 'PM2.5')}
                >
                  <MaterialCommunityIcons name="swap-horizontal" size={14} color={status.color} />
                  <Text style={[styles.switchModeText, { color: status.color }]}>
                    สลับดู {displayMode === 'PM2.5' ? 'AQI' : 'PM2.5'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.pmValue}>{currentValue}</Text>
              <Text style={styles.statusText}>{status.text}</Text>
              
              {/* แสดงอุณหภูมิและความชื้น */}
              <View style={styles.weatherRow}>
                {weather.temp !== null && (
                  <Text style={styles.weatherChip}>🌡 {weather.temp}°C</Text>
                )}
                {weather.humidity !== null && (
                  <Text style={styles.weatherChip}>💧 {weather.humidity}%</Text>
                )}
              </View>
              <Text style={styles.locationText}>{locationName}</Text>
              <Text style={styles.timeText}>🕒 อัปเดต {airData.time} น.</Text>
            </View>
            <View style={styles.avatarContainer}>
              <MaterialCommunityIcons
                name={
                  userGroup === 'outdoor' ? 'hard-hat' :
                  userGroup === 'elderly' ? 'human-cane' :
                  userGroup === 'patient' ? 'hospital-box' : 'account'
                }
                size={80} color="rgba(255,255,255,0.8)"
              />
            </View>
          </View>

          {/* ── Tab Bar ── */}
          <View style={styles.tabBar}>
            {[
              { key: 'advice',    icon: 'hand-left',   label: 'การปฏิบัติตัว' },
              { key: 'knowledge', icon: 'book-outline', label: 'ความรู้ PM2.5' },
            ].map(({ key, icon, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.tabItem, activeTab === key && styles.activeTabItem]}
                onPress={() => setActiveTab(key)}
              >
                <Ionicons name={icon} size={18} color={activeTab === key ? '#2C5282' : '#A0AEC0'} />
                <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab Content ── */}
          {activeTab === 'advice' ? (
            <View style={styles.recommendationSection}>
              {/* badge แจ้งข้อมูลสถานะจำเพาะตามโหมดและกลุ่มที่เลือก */}
              <View style={styles.contextBadge}>
                <Ionicons name="information-circle-outline" size={14} color="#2C5282" />
                <Text style={styles.contextBadgeText}>
                  คำแนะนำสำหรับ "{GROUP_CONFIG.find(g => g.key === userGroup)?.label}" · {displayMode}: {currentValue} {displayMode === 'PM2.5' ? 'µg/m³' : 'แต้ม'}
                  {weather.temp !== null ? ` · ${weather.temp}°C` : ''}
                  {weather.humidity !== null ? ` · ความชื้น ${weather.humidity}%` : ''}
                </Text>
              </View>

              {recommendations.map((item, i) => (
                <View key={i} style={[styles.adviceItem, { borderLeftColor: item.color, borderLeftWidth: 4 }]}>
                  <View style={[styles.adviceIconBox, { backgroundColor: item.color + '20' }]}>
                    {item.lib === 'Ionicons'
                      ? <Ionicons name={item.icon} size={28} color={item.color} />
                      : <MaterialCommunityIcons name={item.icon} size={28} color={item.color} />}
                  </View>
                  <View style={styles.adviceContent}>
                    <Text style={[styles.adviceTitle, { color: item.color }]}>{item.title}</Text>
                    <Text style={styles.adviceDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.knowledgeSection}>
              <Text style={styles.knowledgeIntro}>📚 แตะที่หัวข้อเพื่อเรียนรู้เพิ่มเติมเกี่ยวกับฝุ่น PM2.5</Text>
              {PM25_KNOWLEDGE.map(item => <KnowledgeCard key={item.id} item={item} />)}
              <View style={styles.sourceBox}>
                <Ionicons name="link-outline" size={14} color="#A0AEC0" />
                <Text style={styles.sourceText}>ข้อมูลอ้างอิง: กรมควบคุมมลพิษ, WHO, Air4Thai</Text>
              </View>
            </View>
          )}

          {/* 🌟 ปุ่มยกเลิกพรีเมี่ยมล่างสุด */}
          {isPremium && (
            <View style={styles.cancelPremiumContainer}>
              {!showCancelConfirm ? (
                <TouchableOpacity 
                  style={styles.triggerCancelBtn} 
                  onPress={() => setShowCancelConfirm(true)}
                >
                  <Text style={styles.triggerCancelText}>ต้องการยกเลิกพรีเมี่ยม ?</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.confirmCancelBox}>
                  <Text style={styles.confirmCancelAlertText}>คุณยืนยันที่จะยกเลิกสถานะพรีเมี่ยมใช่หรือไม่ ?</Text>
                  <View style={styles.confirmActionRow}>
                    <TouchableOpacity 
                      style={styles.actionConfirmBtn}
                      onPress={() => {
                        setIsPremium(false);
                        setShowCancelConfirm(false);
                        Alert.alert('ยกเลิกสำเร็จ', 'ระบบได้ยกเลิกสถานะพรีเมี่ยมของคุณแล้ว');
                      }}
                    >
                      <Text style={styles.actionConfirmText}>ยืนยันการยกเลิก</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.actionCloseBtn}
                      onPress={() => setShowCancelConfirm(false)}
                    >
                      <Text style={styles.actionCloseText}>ย้อนกลับ</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F9FAFB' },
  header:         { paddingTop: 60, paddingBottom: 15, backgroundColor: 'white', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle:    { fontSize: 20, fontWeight: 'bold', color: '#333' },
  scrollContent:  { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:    { marginTop: 10, color: '#4A5568', fontSize: 14, fontWeight: 'bold' },

  membershipWrapper: { marginBottom: 25 },
  inlineRegisterBox: { backgroundColor: 'white', padding: 20, borderRadius: 16, elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  inlineRegisterTitle: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', marginBottom: 12, textAlign: 'center' },
  phoneInputInline: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, textAlign: 'center' },
  applyNormalBtn: { flexDirection: 'row', backgroundColor: '#2C5282', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  applyNormalText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  
  applyPremiumBtn: { flexDirection: 'row', backgroundColor: '#D4AF37', padding: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 3 },
  applyPremiumText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  premiumStatusActive: { flexDirection: 'row', backgroundColor: '#FFF9E6', padding: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#D4AF37' },
  premiumStatusActiveText: { color: '#B8860B', fontWeight: 'bold', fontSize: 14 },

  groupSelectionContainer: { marginBottom: 25 },
  sectionTitle:   { fontSize: 16, fontWeight: 'bold', color: '#4A5568', marginBottom: 15 },
  groupGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  groupCard:      { width: '48%', backgroundColor: 'white', paddingVertical: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15, elevation: 2 },
  activeGroupCard:{ backgroundColor: '#2C5282', borderColor: '#2C5282' },
  groupCardText:  { fontSize: 14, color: '#718096', fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  activeGroupText:{ color: 'white' },

  statusCard:     { flexDirection: 'row', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 4 },
  statusInfo:     { flex: 1 },
  statusLabel:    { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: 'bold' },
  pmValue:        { color: 'white', fontSize: 58, fontWeight: 'bold', lineHeight: 62 },
  statusText:     { color: 'white', fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  weatherRow:     { flexDirection: 'row', gap: 8, marginTop: 8 },
  weatherChip:    { color: 'white', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  locationText:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 8 },
  timeText:       { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  avatarContainer:{ justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 10 },

  // 🌟 เพิ่มสไตล์ส่วนปุ่มสลับค่า PM2.5 / AQI
  modeToggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingRight: 5 },
  switchModeBtn:  { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignItems: 'center', gap: 4, elevation: 2 },
  switchModeText: { fontSize: 14, fontWeight: 'bold' },

  tabBar:         { flexDirection: 'row', backgroundColor: 'white', borderRadius: 14, padding: 4, marginBottom: 20, elevation: 2 },
  tabItem:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  activeTabItem:  { backgroundColor: '#EBF4FF' },
  tabText:        { fontSize: 14, fontWeight: '600', color: '#A0AEC0' },
  activeTabText:  { color: '#2C5282' },

  contextBadge:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF4FF', borderRadius: 10, padding: 10, marginBottom: 14, gap: 6 },
  contextBadgeText: { flex: 1, fontSize: 12, color: '#2C5282', fontWeight: '600', lineHeight: 18 },

  recommendationSection: { flex: 1 },
  adviceItem:     { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 12, alignItems: 'center', elevation: 1 },
  adviceIconBox:  { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  adviceContent:  { flex: 1 },
  adviceTitle:    { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  adviceDesc:     { fontSize: 12, color: '#718096', lineHeight: 18 },

  knowledgeSection: { flex: 1 },
  knowledgeIntro: { fontSize: 13, color: '#718096', marginBottom: 14, lineHeight: 20, textAlign: 'center' },
  knowledgeCard:  { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, elevation: 1 },
  knowledgeHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  knowledgeIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  knowledgeTitle: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#2D3748' },
  knowledgeBody:  { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  knowledgeContent: { fontSize: 13, color: '#4A5568', lineHeight: 22 },
  sourceBox:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, justifyContent: 'center' },
  sourceText:     { fontSize: 11, color: '#A0AEC0', fontStyle: 'italic' },

  cancelPremiumContainer: { marginTop: 25, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 20, alignItems: 'center' },
  triggerCancelBtn: { padding: 10 },
  triggerCancelText: { color: '#E53E3E', fontSize: 14, textDecorationLine: 'underline', fontWeight: '500' },
  confirmCancelBox: { backgroundColor: '#FFF5F5', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#FED7D7', width: '100%', alignItems: 'center' },
  confirmCancelAlertText: { fontSize: 14, color: '#C53030', fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  confirmActionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionConfirmBtn: { flex: 1, backgroundColor: '#E53E3E', padding: 12, borderRadius: 10, alignItems: 'center' },
  actionConfirmText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  actionCloseBtn: { flex: 1, backgroundColor: '#EDF2F7', padding: 12, borderRadius: 10, alignItems: 'center' },
  actionCloseText: { color: '#4A5568', fontWeight: 'bold', fontSize: 14 },
});