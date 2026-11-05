import React, { createContext, useState } from 'react';

// สร้าง Context
export const AppContext = createContext();

// สร้าง Provider เพื่อห่อหุ้มแอปและส่งต่อข้อมูล
export const AppProvider = ({ children }) => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  return (
    <AppContext.Provider value={{ isRegistered, setIsRegistered, isPremium, setIsPremium }}>
      {children}
    </AppContext.Provider>
  );
};