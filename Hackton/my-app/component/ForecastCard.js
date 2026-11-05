import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ForecastCard({ day, date, value, color, statusText }) {
  return (
    <View style={styles.card}>
      <Text style={styles.dayText}>{day}</Text>
      <Text style={styles.dateText}>{date}</Text>
      
      <View style={[styles.valueBadge, { backgroundColor: color }]}>
        <Text style={styles.valueText}>{value}</Text>
      </View>
      
      <Text style={[styles.statusText, { color: color }]} numberOfLines={1}>
        {statusText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    width: 110,      
    marginRight: 15, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2, 
  },
  dayText: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  dateText: { fontSize: 12, color: 'gray', marginBottom: 10 },
  valueBadge: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  valueText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  statusText: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
});