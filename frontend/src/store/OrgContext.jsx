import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiGet, setActiveOrg, getActiveOrg } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setOrgs([]); setCurrent(null); setLoading(false); return; }
    setLoading(true);
    try {
      const list = await apiGet('/organizations');
      setOrgs(list);
      const savedId = getActiveOrg();
      const pick = list.find((o) => o.id === savedId) || list[0] || null;
      if (pick) setActiveOrg(pick.id);
      setCurrent(pick);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const switchOrg = (id) => {
    const org = orgs.find((o) => o.id === id);
    if (org) { setActiveOrg(id); setCurrent(org); }
  };

  return (
    <OrgContext.Provider value={{ orgs, current, loading, refresh, switchOrg, setCurrent }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
