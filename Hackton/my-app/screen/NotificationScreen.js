import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ชื่อ Task สำหรับ Background Fetch
const BACKGROUND_FETCH_TASK = 'background-pm25-check';

// ฟังก์ชันช่วยคำนวณระยะทาง (ต้องประกาศก่อน TaskManager.defineTask)
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

// ✅ แก้ไข fetchClosestStation: ใช้ nameTH ก่อน (ตัวพิมพ์ใหญ่ตาม API จริง) แล้วค่อย fallback
const fetchClosestStation = async (lat, lon) => {
  const response = await fetch('http://air4thai.com/forweb/getAQI_JSON.php');
  const data = await response.json();
  const stations = data.stations || [];
  if (stations.length === 0) return null;

  let closest = stations[0];
  let minDist = getDistanceFromLatLonInKm(lat, lon, parseFloat(closest.lat), parseFloat(closest.long));

  for (let i = 1; i < stations.length; i++) {
    const dist = getDistanceFromLatLonInKm(lat, lon, parseFloat(stations[i].lat), parseFloat(stations[i].long));
    if (dist < minDist) { minDist = dist; closest = stations[i]; }
  }

  let pm25Val = 0;
  if (closest.AQILast?.PM25?.value !== '-') {
    pm25Val = parseFloat(closest.AQILast?.PM25?.value || '0');
  }

  // ✅ fallback chain ครอบทุก key ที่ Air4Thai อาจส่งมา
  const displayName =
    closest.nameTH ||
    closest.nameTh ||
    closest.nameEn ||
    closest.areaTH ||
    closest.areaTh ||
    'ไม่ทราบชื่อสถานี';

  return {
    pm25: pm25Val,
    stationName: displayName,
    stationNameTh: displayName,
    distanceKm: minDist.toFixed(1),
  };
};

const getPMAdviceAndStatus = (value) => {
  if (value <= 25) return {
    statusText: 'อากาศดีมาก',
    advice: 'คุณภาพอากาศดีมาก เหมาะสำหรับกิจกรรมกลางแจ้งและการท่องเที่ยว',
    type: 'info', category: 'announce', color: '#29B6F6', icon: 'checkmark-circle'
  };
  if (value <= 37) return {
    statusText: 'อากาศดี',
    advice: 'คุณภาพอากาศดี สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ',
    type: 'info', category: 'announce', color: '#66BB6A', icon: 'checkmark-circle'
  };
  if (value <= 50) return {
    statusText: 'ปานกลาง',
    advice: 'ประชาชนทั่วไปทำกิจกรรมได้ปกติ / ผู้ป่วยควรลดเวลาทำกิจกรรมกลางแจ้ง',
    type: 'warning', category: 'warning', color: '#FFCA28', icon: 'alert-circle'
  };
  if (value <= 90) return {
    statusText: 'เริ่มมีผลกระทบต่อสุขภาพ',
    advice: 'ควรเฝ้าระวังสุขภาพ ลดเวลาทำกิจกรรมกลางแจ้ง ใช้อุปกรณ์ป้องกัน (หน้ากาก)',
    type: 'warning', category: 'warning', color: '#FFA726', icon: 'warning'
  };
  return {
    statusText: 'มีผลกระทบต่อสุขภาพ (อันตราย)',
    advice: 'ทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง ใช้อุปกรณ์ป้องกันอย่างเคร่งครัด หากมีอาการผิดปกติควรรีบพบแพทย์',
    type: 'danger', category: 'warning', color: '#EF5350', icon: 'warning'
  };
};

// --------------------------------------------------------
// 🔵 Background Task — รันตอนแอปปิดอยู่
// ต้องประกาศที่ระดับ module (นอก component)
// --------------------------------------------------------
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const savedLocation = await AsyncStorage.getItem('lastLocation');
    const savedThreshold = await AsyncStorage.getItem('alertThreshold');
    if (!savedLocation) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { latitude, longitude, locationName } = JSON.parse(savedLocation);
    const threshold = savedThreshold ? parseFloat(savedThreshold) : 50;

    const stationData = await fetchClosestStation(latitude, longitude);
    if (!stationData) return BackgroundFetch.BackgroundFetchResult.Failed;

    const { pm25, stationNameTh, distanceKm } = stationData;

    // บันทึกค่าล่าสุดลง AsyncStorage
    await AsyncStorage.setItem('lastPM25', pm25.toString());

    // แจ้งเตือนถ้าเกิน threshold
    if (pm25 >= threshold) {
      const details = getPMAdviceAndStatus(pm25);
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⚠️ PM2.5: ${pm25} µg/m³ — ${details.statusText}`,
            body: `${locationName} (${stationNameTh}, ${distanceKm} km)\n${details.advice}`,
            sound: true,
          },
          trigger: null,
        });

        // บันทึกประวัติแจ้งเตือนลง AsyncStorage
        const existing = await AsyncStorage.getItem('notificationHistory');
        const history = existing ? JSON.parse(existing) : [];
        const now = new Date();
        history.unshift({
          id: Date.now().toString(),
          type: details.type,
          title: `ค่า PM2.5: ${pm25} (${details.statusText})`,
          date: now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
          time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          message: `พื้นที่: ${locationName}\nสถานี: ${stationNameTh} (${distanceKm} km)\nคำแนะนำ: ${details.advice}`,
          category: details.category,
        });
        // เก็บแค่ 50 รายการล่าสุด
        await AsyncStorage.setItem('notificationHistory', JSON.stringify(history.slice(0, 50)));
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.error('Background task error:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ตั้งค่าการแสดง notification
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --------------------------------------------------------
// 🟢 Component หลัก
// --------------------------------------------------------
export default function NotificationScreen() {
  const [activeTab, setActiveTab] = useState('all');
  const [locationName, setLocationName] = useState('กำลังค้นหา...');
  const [currentPM25, setCurrentPM25] = useState(0);
  const [stationInfo, setStationInfo] = useState(null); // { stationNameTh, distanceKm }
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('50');
  const [tempThreshold, setTempThreshold] = useState('50');

  const lastAlertedPM25 = useRef(-1);
  const coordsRef = useRef(null);
  const locationNameRef = useRef('ตำแหน่งปัจจุบัน');
  const refreshTimerRef = useRef(null);

  // โหลดประวัติและ threshold จาก AsyncStorage
  useEffect(() => {
    (async () => {
      const history = await AsyncStorage.getItem('notificationHistory');
      if (history) setNotifications(JSON.parse(history));

      const threshold = await AsyncStorage.getItem('alertThreshold');
      if (threshold) {
        setAlertThreshold(threshold);
        setTempThreshold(threshold);
      }
    })();
  }, []);

  // ลงทะเบียน Background Fetch
  const registerBackgroundFetch = async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 15 * 60, // ทุก 15 นาที (iOS อาจไม่แม่นยำ 100%)
          stopOnTerminate: false,   // รันแม้แอปถูก terminate (Android)
          startOnBoot: true,        // รันหลัง reboot (Android)
        });
        console.log('Background fetch registered');
      }
    } catch (e) {
      console.warn('Background fetch register error:', e);
    }
  };

  // ดึงข้อมูล PM2.5 และอัปเดต state
  const fetchAndUpdate = useCallback(async (lat, lon, locName) => {
    try {
      const stationData = await fetchClosestStation(lat, lon);
      if (!stationData) return;

      const { pm25, stationNameTh, distanceKm } = stationData;
      setCurrentPM25(pm25);
      setStationInfo({ stationNameTh, distanceKm });
      setLastUpdated(new Date());

      // บันทึกตำแหน่งล่าสุดสำหรับ background task
      await AsyncStorage.setItem('lastLocation', JSON.stringify({ latitude: lat, longitude: lon, locationName: locName }));
      await AsyncStorage.setItem('lastPM25', pm25.toString());

      // แจ้งเตือนถ้าค่าเปลี่ยนและเกิน threshold
      const threshold = parseFloat(alertThreshold) || 50;
      if (pm25 > 0 && pm25 !== lastAlertedPM25.current && pm25 >= threshold) {
        const details = getPMAdviceAndStatus(pm25);
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⚠️ PM2.5: ${pm25} µg/m³ — ${details.statusText}`,
              body: `${locName} (${stationNameTh}, ${distanceKm} km)\n${details.advice}`,
              sound: true,
            },
            trigger: null,
          });

          const now = new Date();
          const newNotif = {
            id: Date.now().toString(),
            type: details.type,
            title: `ค่า PM2.5: ${pm25} (${details.statusText})`,
            date: now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
            time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            message: `พื้นที่: ${locName}\nสถานี: ${stationNameTh} (${distanceKm} km)\nคำแนะนำ: ${details.advice}`,
            category: details.category,
          };

          setNotifications(prev => {
            const updated = [newNotif, ...prev].slice(0, 50);
            AsyncStorage.setItem('notificationHistory', JSON.stringify(updated));
            return updated;
          });
        }
        lastAlertedPM25.current = pm25;
      }
    } catch (err) {
      console.error('fetchAndUpdate error:', err);
    }
  }, [alertThreshold]);

  // Init: ขอ permission และดึงตำแหน่ง
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationName('ไม่ได้ระบุตำแหน่ง');
          setIsLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        coordsRef.current = { latitude, longitude };

        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        let locName = 'ตำแหน่งปัจจุบัน';
        if (reverseGeocode.length > 0) {
          const area = reverseGeocode[0];
          locName = area.district || area.subregion || area.province || 'ตำแหน่งปัจจุบัน';
        }
        setLocationName(locName);
        locationNameRef.current = locName;

        await fetchAndUpdate(latitude, longitude, locName);
        await registerBackgroundFetch();
      } catch (err) {
        console.error('Init error:', err);
        setLocationName('ค้นหาตำแหน่งไม่สำเร็จ');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ⏱️ Auto-refresh ทุก 10 นาที (ตอนแอปเปิดอยู่)
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);

    refreshTimerRef.current = setInterval(() => {
      if (coordsRef.current) {
        const { latitude, longitude } = coordsRef.current;
        fetchAndUpdate(latitude, longitude, locationNameRef.current);
      }
    }, 10 * 60 * 1000); // 10 นาที

    return () => clearInterval(refreshTimerRef.current);
  }, [fetchAndUpdate]);

  // บันทึก threshold ใหม่
  const saveThreshold = async () => {
    const val = parseFloat(tempThreshold);
    if (isNaN(val) || val < 1 || val > 500) {
      Alert.alert('ค่าไม่ถูกต้อง', 'กรุณากรอกตัวเลข 1–500');
      return;
    }
    setAlertThreshold(tempThreshold);
    await AsyncStorage.setItem('alertThreshold', tempThreshold);
    setShowSettings(false);
    Alert.alert('บันทึกแล้ว', `จะแจ้งเตือนเมื่อ PM2.5 ≥ ${tempThreshold} µg/m³`);
  };

  // ปุ่มรีเฟรชมือ
  const handleManualRefresh = async () => {
    if (!coordsRef.current) return;
    setIsLoading(true);
    await fetchAndUpdate(coordsRef.current.latitude, coordsRef.current.longitude, locationNameRef.current);
    setIsLoading(false);
  };

  // ปุ่มทดสอบ
  const triggerTestNotification = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ไม่ได้รับอนุญาต', 'กรุณาอนุญาตการแจ้งเตือนในตั้งค่าเครื่องก่อน');
      return;
    }
    const details = getPMAdviceAndStatus(currentPM25);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${details.statusText} (${currentPM25} µg/m³)`,
        body: details.advice,
        sound: true,
      },
      trigger: null,
    });
  };

  // ล้างประวัติ
  const clearHistory = () => {
    Alert.alert('ล้างประวัติ', 'ต้องการลบประวัติแจ้งเตือนทั้งหมด?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          setNotifications([]);
          await AsyncStorage.removeItem('notificationHistory');
        }
      },
    ]);
  };

  const filteredNotifications = notifications.filter(item =>
    activeTab === 'all' || item.category === activeTab
  );

  const getStyleByType = (type) => {
    switch (type) {
      case 'danger': return { icon: 'alert-circle', color: '#EF5350', bg: '#FFEBEE' };
      case 'warning': return { icon: 'warning', color: '#FFA726', bg: '#FFF8E1' };
      default: return { icon: 'checkmark-circle', color: '#29B6F6', bg: '#E1F5FE' };
    }
  };

  const currentStatusConfig = getPMAdviceAndStatus(currentPM25);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>แจ้งเตือนคุณภาพอากาศ</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleManualRefresh}>
              <Ionicons name="refresh" size={18} color="#4A5568" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => { setTempThreshold(alertThreshold); setShowSettings(true); }}>
              <Ionicons name="settings-outline" size={18} color="#4A5568" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.testButton} onPress={triggerTestNotification}>
              <Ionicons name="notifications" size={14} color="white" style={{ marginRight: 4 }} />
              <Text style={styles.testButtonText}>ทดสอบ</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* แถบ threshold ปัจจุบัน */}
        <View style={styles.thresholdBadge}>
          <Ionicons name="options-outline" size={12} color="#718096" />
          <Text style={styles.thresholdText}>แจ้งเตือนเมื่อ PM2.5 ≥ {alertThreshold} µg/m³</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Card สถานะปัจจุบัน */}
        <View style={styles.currentAlertContainer}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionHeading}>ตำแหน่งของคุณตอนนี้</Text>
            {lastUpdated && (
              <Text style={styles.lastUpdatedText}>
                อัปเดต {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              </Text>
            )}
          </View>

          {isLoading ? (
            <View style={[styles.currentAlertCard, { backgroundColor: '#A0AEC0', alignItems: 'center' }]}>
              <ActivityIndicator size="small" color="white" />
              <Text style={{ color: 'white', marginTop: 10 }}>กำลังดึงข้อมูล API...</Text>
            </View>
          ) : (
            <View style={[styles.currentAlertCard, { backgroundColor: currentStatusConfig.color }]}>
              <View style={styles.alertTopRow}>
                <View style={styles.locationTag}>
                  <Ionicons name="location" size={14} color={currentStatusConfig.color} />
                  <Text style={[styles.locationTagText, { color: currentStatusConfig.color }]} numberOfLines={1}>
                    {locationName}
                  </Text>
                </View>
                <MaterialCommunityIcons name="face-mask" size={24} color="rgba(255,255,255,0.8)" />
              </View>

              <View style={styles.alertMiddleRow}>
                <Text style={styles.alertValueText}>{currentPM25}</Text>
                <View style={styles.alertUnitContainer}>
                  <Text style={styles.alertUnitText}>PM2.5</Text>
                  <Text style={styles.alertUnitSub}>µg/m³</Text>
                </View>
              </View>

              <View style={styles.alertBottomRow}>
                <Ionicons name={currentStatusConfig.icon} size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.alertStatusText}>{currentStatusConfig.statusText}</Text>
              </View>

              {stationInfo && (
                <View style={styles.stationRow}>
                  <Ionicons name="business-outline" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.stationText}>
                    สถานี: {stationInfo.stationNameTh} ({stationInfo.distanceKm} km)
                  </Text>
                </View>
              )}

              <View style={styles.adviceContainer}>
                <Text style={styles.adviceText}>📋 วิธีเตรียมตัว: {currentStatusConfig.advice}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {[['all', 'ทั้งหมด'], ['announce', 'อัปเดต'], ['warning', 'คำเตือน']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabButton, activeTab === key && styles.activeTab]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
            </TouchableOpacity>
          ))}
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearHistory}>
              <Ionicons name="trash-outline" size={14} color="#EF5350" />
            </TouchableOpacity>
          )}
        </View>

        {/* รายการประวัติ */}
        <View style={styles.scrollContent}>
          {filteredNotifications.map((notif) => {
            const styleConfig = getStyleByType(notif.type);
            return (
              <View key={notif.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <Ionicons name={styleConfig.icon} size={24} color={styleConfig.color} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardTitle, { color: styleConfig.color }]}>{notif.title}</Text>
                  </View>
                  <View style={[styles.dateBadge, { backgroundColor: styleConfig.bg }]}>
                    <Text style={[styles.dateText, { color: styleConfig.color }]}>{notif.date}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.timeText}>{notif.time}</Text>
                  <Text style={styles.messageText}>{notif.message}</Text>
                </View>
              </View>
            );
          })}

          {filteredNotifications.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#CBD5E0" />
              <Text style={styles.emptyText}>ยังไม่มีประวัติการแจ้งเตือนจากระบบ</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ⚙️ Modal ตั้งค่า Threshold */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>⚙️ ตั้งค่าการแจ้งเตือน</Text>
            <Text style={styles.modalLabel}>แจ้งเตือนเมื่อ PM2.5 ถึง (µg/m³)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={tempThreshold}
              onChangeText={setTempThreshold}
              placeholder="เช่น 50"
              maxLength={5}
            />
            <Text style={styles.modalHint}>
              แนะนำ: {'\n'}≥ 37 = ระวัง (สีเหลือง){'\n'}≥ 51 = เริ่มอันตราย (สีส้ม){'\n'}≥ 91 = อันตราย (สีแดง)
            </Text>

            <View style={styles.bgStatusRow}>
              <Ionicons name="time-outline" size={14} color="#718096" />
              <Text style={styles.bgStatusText}>Background fetch: ทุก 15 นาที (เมื่อแอปปิด)</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSettings(false)}>
                <Text style={styles.modalCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveThreshold}>
                <Text style={styles.modalSaveText}>บันทึก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 60, paddingBottom: 10, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#EEE', paddingHorizontal: 15,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    backgroundColor: '#EDF2F7', padding: 7, borderRadius: 20,
  },
  testButton: {
    flexDirection: 'row', backgroundColor: '#4A5568',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, alignItems: 'center',
  },
  testButtonText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  thresholdBadge: {
    flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4,
  },
  thresholdText: { fontSize: 11, color: '#718096' },

  currentAlertContainer: {
    padding: 20, backgroundColor: 'white',
    borderBottomLeftRadius: 25, borderBottomRightRadius: 25,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 3,
  },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeading: { fontSize: 14, fontWeight: 'bold', color: '#718096' },
  lastUpdatedText: { fontSize: 11, color: '#A0AEC0' },

  currentAlertCard: {
    padding: 20, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  alertTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  locationTag: {
    flexDirection: 'row', backgroundColor: 'white',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    alignItems: 'center', flexShrink: 1, maxWidth: '80%',
  },
  locationTagText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  alertMiddleRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  alertValueText: { fontSize: 55, fontWeight: 'bold', color: 'white', lineHeight: 60 },
  alertUnitContainer: { marginLeft: 8 },
  alertUnitText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  alertUnitSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  alertBottomRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start',
  },
  alertStatusText: { fontSize: 14, fontWeight: 'bold', color: 'white' },
  stationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  stationText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  adviceContainer: {
    marginTop: 15, paddingTop: 15,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)',
  },
  adviceText: { fontSize: 13, color: 'white', lineHeight: 20, fontWeight: '500' },

  tabContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15 },
  tabButton: {
    paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20,
    marginHorizontal: 5, backgroundColor: '#EDF2F7',
  },
  activeTab: { backgroundColor: '#4A5568' },
  tabText: { fontSize: 14, color: '#718096', fontWeight: 'bold' },
  activeTabText: { color: 'white' },
  clearBtn: {
    backgroundColor: '#FFF0F0', padding: 8, borderRadius: 20, marginLeft: 4,
  },

  scrollContent: { paddingHorizontal: 15, paddingBottom: 30 },
  card: {
    backgroundColor: 'white', borderRadius: 15, padding: 15, marginBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', flexShrink: 1 },
  dateBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  dateText: { fontSize: 11, fontWeight: 'bold' },
  cardBody: { marginBottom: 5 },
  timeText: { fontSize: 12, fontWeight: 'bold', color: '#A0AEC0', marginBottom: 8 },
  messageText: { fontSize: 13, color: '#4A5568', lineHeight: 20 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { textAlign: 'center', color: '#A0AEC0', marginTop: 15, fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: 'white', borderTopLeftRadius: 25,
    borderTopRightRadius: 25, padding: 25,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  modalLabel: { fontSize: 14, color: '#4A5568', marginBottom: 8 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#CBD5E0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 20, fontWeight: 'bold', color: '#2D3748', marginBottom: 12,
  },
  modalHint: { fontSize: 12, color: '#718096', lineHeight: 20, marginBottom: 12 },
  bgStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20 },
  bgStatusText: { fontSize: 12, color: '#718096' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#EDF2F7', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: 'bold', color: '#718096' },
  modalSave: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#4A5568', alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, fontWeight: 'bold', color: 'white' },
});