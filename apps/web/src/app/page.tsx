'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface Report {
  id: string;
  type: string;
  status: string;
  severity: number;
  createdAt: Timestamp;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({ active: 0, resolved: 0, critical: 0 });

  useEffect(() => {
    if (!user) return;

    // Listen to recent reports
    const q = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newReports: Report[] = [];
      let active = 0;
      let resolved = 0;
      let critical = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        newReports.push({ id: doc.id, ...data } as Report);

        if (data.status === 'resolved') resolved++;
        else active++;

        if (data.severity >= 4 && data.status !== 'resolved') critical++;
      });

      setReports(newReports);
      setStats({ active, resolved, critical });
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Incidents</p>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg mr-4">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Critical Priority</p>
            <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg mr-4">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Resolved Today</p>
            <p className="text-2xl font-bold text-gray-900">{stats.resolved}</p>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">Live Incident Feed</h2>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-auto">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No active incidents reported.</div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-gray-900 capitalize">{report.type.replace('-', ' ')}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      report.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      report.status === 'confirmed' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Severity: {report.severity}/5 • Reported: {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString() : report.createdAt ? new Date(report.createdAt as unknown as string).toLocaleString() : 'Just now'}
                  </p>
                </div>
                <div className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer">
                  View Details
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
