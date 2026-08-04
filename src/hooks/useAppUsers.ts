import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';

let globalAppUsersCache: AppUser[] = [];
let globalAppUsersListeners: Array<() => void> = [];
let isSubscribedToGlobalUsers = false;

const subscribeGlobalUsers = () => {
  if (isSubscribedToGlobalUsers) return;
  isSubscribedToGlobalUsers = true;
  try {
    onSnapshot(collection(db, 'users'), (snapshot) => {
      globalAppUsersCache = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as AppUser));
      globalAppUsersListeners.forEach(cb => cb());
    }, (err) => {
      console.error("Error listening to global users:", err);
    });
  } catch (e) {
    console.error("Global users listener init error:", e);
  }
};

export const useAppUsers = () => {
  const [users, setUsers] = useState<AppUser[]>(globalAppUsersCache);

  useEffect(() => {
    subscribeGlobalUsers();
    const listener = () => setUsers([...globalAppUsersCache]);
    globalAppUsersListeners.push(listener);
    return () => {
      globalAppUsersListeners = globalAppUsersListeners.filter(l => l !== listener);
    };
  }, []);

  const getOperatorProfile = useCallback((operatorId?: string, operatorName?: string, fallbackPhotoUrl?: string) => {
    if (operatorId) {
      const match = users.find(u => u.uid === operatorId);
      if (match) {
        return {
          name: match.name || match.email,
          photoUrl: match.avatarUrl || (match as any).photoURL || fallbackPhotoUrl,
          rut: match.rut,
          cargo: match.cargo
        };
      }
    }

    if (operatorName) {
      const cleanName = operatorName.trim().toLowerCase();
      const match = users.find(u => 
        (u.name && u.name.trim().toLowerCase() === cleanName) || 
        (u.email && u.email.trim().toLowerCase() === cleanName)
      );
      if (match) {
        return {
          name: match.name || match.email,
          photoUrl: match.avatarUrl || (match as any).photoURL || fallbackPhotoUrl,
          rut: match.rut,
          cargo: match.cargo
        };
      }
    }

    return {
      name: operatorName || 'Operador',
      photoUrl: fallbackPhotoUrl || undefined,
      rut: undefined,
      cargo: undefined
    };
  }, [users]);

  return { users, getOperatorProfile };
};
