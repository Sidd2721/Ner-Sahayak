'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { calcContinuityGap, continuityStatus } from '@shared/risk/calcContinuity';
import { riskCategory, CLOSURE_DAYS_BY_CATEGORY } from '@shared/risk/calcRisk';
import type { District } from '@shared/schemas/district';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-100 shadow-lg rounded-xl">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="text-emerald-600">Buffer Stock: {data.stockBufferDays} days</p>
          <p className="text-amber-600">Expected Closure: {data.expectedClosureDays} days</p>
          <div className="pt-2 mt-2 border-t border-gray-50">
            <p className="font-medium text-red-600">Continuity Gap: {data.expectedClosureDays - data.stockBufferDays} days</p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ContinuityPage() {
  const { user } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'districts'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newDistricts: District[] = [];
      snapshot.forEach((doc) => {
        newDistricts.push({ id: doc.id, ...doc.data() } as District);
      });
      setDistricts(newDistricts);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  const getStatusStyle = (status: string) => {
    if (status === 'OK') return { color: 'bg-green-100 text-green-800 border-green-200', icon: '🟢' };
    if (status === 'WATCH') return { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🟠' };
    return { color: 'bg-red-100 text-red-800 border-red-200', icon: '🔴' };
  };

  const chartData = districts.map(d => {
    const cat = riskCategory(d.currentRiskScore);
    const expectedClosureDays = CLOSURE_DAYS_BY_CATEGORY[cat];
    const gap = calcContinuityGap(d.stockBufferDays, cat);
    return {
      name: d.name.split(' ')[0], // short name for Y axis
      fullName: d.name,
      stockBufferDays: d.stockBufferDays,
      expectedClosureDays,
      continuityGap: gap
    };
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Supply Continuity Impact</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-3xl mb-8">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">Continuity Gap Overview</h2>
        {districts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border rounded-lg">
            No district data available for visualization.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <defs>
                  <linearGradient id="closureGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 500 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="stockBufferDays" name="Buffer Stock (Days)" fill="#10B981" barSize={20} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" radius={[0, 4, 4, 0]} />
                <Bar dataKey="expectedClosureDays" name="Expected Closure (Days)" fill="url(#closureGradient)" barSize={20} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-3xl">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">Live District Continuity Status</h2>
        
        {districts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border rounded-lg">
            No district data available.
          </div>
        ) : (
          <div className="space-y-4">
            {districts.map((district) => {
              const cat = riskCategory(district.currentRiskScore);
              const gap = calcContinuityGap(district.stockBufferDays, cat);
              const status = continuityStatus(gap);

              return (
                <div key={district.id} className="p-5 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{district.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500">Connectivity:</span>
                        <select 
                          className="text-sm border rounded px-2 py-1 outline-none bg-white"
                          value={district.connectivityStatus}
                          onChange={async (e) => {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'districts', district.id), {
                              connectivityStatus: e.target.value
                            });
                          }}
                        >
                          <option value="connected">Connected</option>
                          <option value="degraded">Degraded</option>
                          <option value="isolated">Isolated</option>
                        </select>
                      </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getStatusStyle(status).color}`}>
                      {getStatusStyle(status).icon} {status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Risk Score</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="0" max="1" step="0.05"
                          className="w-20"
                          value={district.currentRiskScore}
                          onChange={async (e) => {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'districts', district.id), {
                              currentRiskScore: parseFloat(e.target.value)
                            });
                          }}
                        />
                        <p className="font-mono font-medium text-sm">
                          {(district.currentRiskScore * 100).toFixed(0)}% <span className="text-gray-400">({cat})</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buffer Stock</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0" max="30"
                          className="w-16 text-sm border rounded px-1 outline-none font-mono"
                          value={district.stockBufferDays}
                          onChange={async (e) => {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'districts', district.id), {
                              stockBufferDays: parseInt(e.target.value, 10)
                            });
                          }}
                        />
                        <span className="font-mono font-medium text-sm">days</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Continuity Gap</p>
                      <p className={`font-mono font-bold ${gap < 0 ? 'text-red-600' : gap <= 2 ? 'text-orange-600' : 'text-green-600'}`}>
                        {gap > 0 ? '+' : ''}{gap} days
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-3 text-right">
                    Last updated: {new Date(district.lastUpdated).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
