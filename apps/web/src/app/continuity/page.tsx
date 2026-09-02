'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { calcRisk, type RiskCategory } from '@shared/risk/calcRisk';
import { calcContinuityGap, continuityStatus } from '@shared/risk/calcContinuity';
import { calcPriorityKey } from '@shared/risk/priorityQueue';

export default function ContinuityPage() {
  const { user } = useAuth();
  
  // Mock data for the corridor
  const [severity, setSeverity] = useState<number>(3);
  const [reportCount, setReportCount] = useState<number>(5);
  
  // District buffers
  const [silcharBuffer, setSilcharBuffer] = useState<number>(7);
  const [haflongBuffer, setHaflongBuffer] = useState<number>(3);

  if (!user) return null;

  // Calculate live risk
  const { category, score } = calcRisk({
    rainfallNorm: severity / 5,
    slopeNorm: severity / 5,
    soilSaturationNorm: severity / 5,
    recentIncidentNorm: reportCount / 20
  });

  // Calculate continuity gaps
  const silcharGap = calcContinuityGap(silcharBuffer, category);
  const silcharStatus = continuityStatus(silcharGap);
  
  const haflongGap = calcContinuityGap(haflongBuffer, category);
  const haflongStatus = continuityStatus(haflongGap);

  // Priority example
  const priorityKey = calcPriorityKey({
    severity,
    corroborationScore: reportCount > 3 ? 1 : reportCount / 3,
    criticalityWeight: 1.0 // NH-27
  });

  const getStatusColor = (status: string) => {
    if (status === 'OK') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'WATCH') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Supply Continuity & Risk</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Risk Simulation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Corridor Risk Simulator</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Average Report Severity (1-5)
              </label>
              <input 
                type="range" min="1" max="5" 
                value={severity} onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-right text-sm font-mono">{severity}</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recent Report Count
              </label>
              <input 
                type="range" min="0" max="20" 
                value={reportCount} onChange={(e) => setReportCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-right text-sm font-mono">{reportCount}</div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-500">Calculated Risk Score</span>
                <span className="text-lg font-bold">{score.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-500">Risk Category</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  category === 'High' || category === 'Severe' ? 'bg-red-100 text-red-800' :
                  category === 'Medium' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                }`}>
                  {category}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Incident Priority Key</span>
                <span className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {priorityKey}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Continuity Impact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Continuity Impact (NH-27)</h2>
          
          <div className="space-y-6">
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900">Silchar District</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(silcharStatus)}`}>
                  {silcharStatus}
                </span>
              </div>
              
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase">Buffer Days</label>
                  <input 
                    type="number" min="0" value={silcharBuffer}
                    onChange={(e) => setSilcharBuffer(Number(e.target.value))}
                    className="block w-full border border-gray-300 rounded p-1 mt-1 font-mono"
                  />
                </div>
              </div>
              
              <div className="text-sm">
                Continuity Gap: <strong className={silcharGap < 0 ? 'text-red-600' : 'text-green-600'}>
                  {silcharGap > 0 ? '+' : ''}{silcharGap} days
                </strong>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900">Dima Hasao (Haflong)</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(haflongStatus)}`}>
                  {haflongStatus}
                </span>
              </div>
              
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase">Buffer Days</label>
                  <input 
                    type="number" min="0" value={haflongBuffer}
                    onChange={(e) => setHaflongBuffer(Number(e.target.value))}
                    className="block w-full border border-gray-300 rounded p-1 mt-1 font-mono"
                  />
                </div>
              </div>
              
              <div className="text-sm">
                Continuity Gap: <strong className={haflongGap < 0 ? 'text-red-600' : 'text-green-600'}>
                  {haflongGap > 0 ? '+' : ''}{haflongGap} days
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
