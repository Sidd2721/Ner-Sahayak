'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';

interface Report {
  id: string;
  type: string;
  status: string;
  severity: number;
  corridorId: string;
  createdAt: Timestamp;
  photoUrl?: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let q;
    if (filterStatus === 'all') {
      q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'reports'),
        where('status', '==', filterStatus),
        orderBy('createdAt', 'desc')
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Report[];
      setReports(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, filterStatus]); // Add filterStatus to dependency array

  if (!user) return null;

  const filteredReports = reports;


  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Incident Reports</h1>
        
        <div className="flex items-center gap-3">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
            Filter Status:
          </label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)} /* Bug Fix #5: Use filterStatus instead of status */
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border outline-none"
          >
            <option value="all">All Incidents</option>
            <option value="unconfirmed">Unconfirmed</option>
            <option value="confirmed">Confirmed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading reports...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type / ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Photo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reported At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No reports found.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {report.type.replace('-', ' ')}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {report.id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {report.corridorId.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {report.photoUrl ? (
                          <img src={report.photoUrl} alt="Incident photo" className="h-10 w-10 rounded object-cover border border-gray-200" />
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`h-2.5 w-2.5 rounded-full mr-2 ${
                            report.severity >= 4 ? 'bg-red-500' :
                            report.severity >= 3 ? 'bg-orange-500' : 'bg-blue-500'
                          }`}></div>
                          <span className="text-sm text-gray-900">{report.severity}/5</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full ${
                          report.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          report.status === 'confirmed' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {report.status === 'resolved' ? '🟢' : report.status === 'confirmed' ? '🟠' : '⚪'} {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString() : report.createdAt ? new Date(report.createdAt as unknown as string).toLocaleString() : 'Unknown'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
