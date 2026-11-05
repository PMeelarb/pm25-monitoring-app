import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { AppContext } from '../context/AppContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function PremiumRegistrationScreen({ navigation }) {
  const { setIsPremium } = useContext(AppContext);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handlePaymentConfirm = () => {
    if (!name || !phone || !password) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    // จำลองการสำเร็จ
    setIsPremium(true);
    Alert.alert('สำเร็จ', 'อัปเกรดเป็นพรีเมี่ยมเรียบร้อยแล้ว', [
      { text: 'ตกลง', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>สมัครสมาชิกพรีเมี่ยม 👑</Text>

      {/* 🌟 กล่องสิทธิประโยชน์ Premium */}
      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>สิ่งที่คุณจะได้รับจาก Premium</Text>
        
        {/* ข้อ 1: การปักหมุด */}
        <View style={styles.benefitItem}>
          <View style={styles.benefitIconBox}>
            <MaterialCommunityIcons name="map-marker-plus" size={24} color="#D4AF37" />
          </View>
          <View style={styles.benefitTextContent}>
            <Text style={styles.benefitItemTitle}>ปักหมุดสถานที่ส่วนตัว</Text>
            <Text style={styles.benefitItemDesc}>สามารถค้นหาและเพิ่มสถานที่ใหม่ๆ ลงบนแผนที่ของคุณเองได้อย่างอิสระ</Text>
          </View>
        </View>

        {/* ข้อ 2: ฟังก์ชันการเกษตร */}
        <View style={styles.benefitItem}>
          <View style={styles.benefitIconBox}>
            <MaterialCommunityIcons name="sprout" size={24} color="#D4AF37" />
          </View>
          <View style={styles.benefitTextContent}>
            <Text style={styles.benefitItemTitle}>ข้อมูลเกษตรเชิงลึก</Text>
            <Text style={styles.benefitItemDesc}>ปลดล็อกฟังก์ชันการเกษตรขั้นสูง พร้อมข้อมูลวิเคราะห์สภาพอากาศแบบลงลึก</Text>
          </View>
        </View>
      </View>

      {/* ฟอร์มกรอกข้อมูล */}
      <View style={styles.formCard}>
        <TextInput style={styles.input} placeholder="ชื่อ - นามสกุล" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="เบอร์โทรศัพท์" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={10} />
        <TextInput style={styles.input} placeholder="ตั้งรหัสผ่าน" secureTextEntry value={password} onChangeText={setPassword} />
      </View>

      {/* จำลอง QR Code */}
      <View style={styles.qrContainer}>
        <Text style={styles.qrText}>สแกน QR เพื่อชำระเงิน</Text>
        <View style={styles.qrMockup}>
          <Ionicons name="qr-code-outline" size={120} color="#2D3748" />
        </View>
        <Text style={styles.priceText}>ยอดชำระ: 100 บาท / ปี</Text>
      </View>

      <TouchableOpacity style={styles.confirmBtn} onPress={handlePaymentConfirm}>
        <Text style={styles.confirmBtnText}>ยืนยันการชำระเงิน</Text>
      </TouchableOpacity>
      
      {/* เพิ่มพื้นที่ว่างด้านล่างเผื่อจอแหว่ง */}
      <View style={{ height: 40 }} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#D4AF37', textAlign: 'center', marginTop: 10, marginBottom: 20 },
  
  // 🌟 สไตล์กล่องสิทธิประโยชน์
  benefitsCard: { backgroundColor: '#FFF9E6', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F5E0A0', elevation: 2 },
  benefitsTitle: { fontSize: 16, fontWeight: 'bold', color: '#B8860B', marginBottom: 16, textAlign: 'center' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  benefitIconBox: { width: 45, height: 45, backgroundColor: 'white', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15, elevation: 1 },
  benefitTextContent: { flex: 1 },
  benefitItemTitle: { fontSize: 15, fontWeight: 'bold', color: '#3D2E00', marginBottom: 2 },
  benefitItemDesc: { fontSize: 12, color: '#666', lineHeight: 18 },

  formCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 2, marginBottom: 20 },
  input: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 10, marginBottom: 15, fontSize: 16 },
  qrContainer: { alignItems: 'center', marginBottom: 20 },
  qrText: { fontSize: 16, color: '#4A5568', marginBottom: 10 },
  qrMockup: { width: 150, height: 150, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', borderRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  priceText: { fontSize: 18, fontWeight: 'bold', color: '#E53E3E', marginTop: 15 },
  confirmBtn: { backgroundColor: '#2C5282', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
  confirmBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});