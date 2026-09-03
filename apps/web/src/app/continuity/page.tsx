'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { calcContinuityGap, continuityStatus } from '@shared/risk/calcContinuity';
import { riskCategory } from '@shared/risk/calcRisk';
import type { District } from '@shared/schemas/district';

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

  const getStatusColor = (status: string) => {
    if (status === 'OK') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'WATCH') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Supply Continuity Impact</h1>

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
                      <p className="text-sm text-gray-500">
                        Connectivity: <span className="capitalize">{district.connectivityStatus}</span>
                      </p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Risk Score</p>
                      <p className="font-mono font-medium">
                        {(district.currentRiskScore * 100).toFixed(1)}% <span className="text-gray-400">({cat})</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buffer Stock</p>
                      <p className="font-mono font-medium">{district.stockBufferDays} days</p>
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
