import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { AppUser } from '../types';

let globalAppUsersCache: AppUser[] = [];
let globalAppUsersListeners: Array<() => void> = [];
let isSubscribedToGlobalUsers = false;
let globalUnsub: (() => void) | null = null;

const subscribeGlobalUsers = () => {
  if (isSubscribedToGlobalUsers) return;
  if (!auth.currentUser) return; // Wait until authenticated user is present
  isSubscribedToGlobalUsers = true;
  try {
    globalUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      globalAppUsersCache = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as AppUser));
      globalAppUsersListeners.forEach(cb => cb());
    }, (err) => {
      isSubscribedToGlobalUsers = false;
      if (globalUnsub) {
        try { globalUnsub(); } catch {}
        globalUnsub = null;
      }
      console.warn("Global users listener warning:", err?.message || err);
    });
  } catch (e) {
    isSubscribedToGlobalUsers = false;
    console.warn("Global users listener init error:", e);
  }
};

export const useAppUsers = () => {
  const [users, setUsers] = useState<AppUser[]>(globalAppUsersCache);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        subscribeGlobalUsers();
      } else {
        isSubscribedToGlobalUsers = false;
        if (globalUnsub) {
          try { globalUnsub(); } catch {}
          globalUnsub = null;
        }
      }
    });

    if (auth.currentUser) {
      subscribeGlobalUsers();
    }

    const listener = () => setUsers([...globalAppUsersCache]);
    globalAppUsersListeners.push(listener);
    return () => {
      globalAppUsersListeners = globalAppUsersListeners.filter(l => l !== listener);
      unsubAuth();
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

    if (operatorName && typeof operatorName === 'string') {
      const cleanName = operatorName.trim().toLowerCase();
      const match = users.find(u => 
        (u.name && typeof u.name === 'string' && u.name.trim().toLowerCase() === cleanName) || 
        (u.email && typeof u.email === 'string' && u.email.trim().toLowerCase() === cleanName)
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
