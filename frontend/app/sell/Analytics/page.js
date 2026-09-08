"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getEquipmentList, getBookings } from "@/lib/api";
import { getSession } from "@/lib/session";
import { formatCurrency } from "@/lib/display";
import Logo from "@/components/Logo";
import BottomNav from "@/components/BottomNav";

export default function SellerAnalyticsPage() {
  const router = useRouter();
  const [session, setSessionState] = useState(null);
  const [equipmentList, setEquipmentList] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/start");
      return;
    }
    if (s.role !== "seller") {
      router.replace("/rent");
      return;
    }
    setSessionState(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      getEquipmentList({ ownerId: session.user_id }),
      getBookings({ ownerId: session.user_id }),
    ])
      .then(([eq, bk]) => {
        setEquipmentList(eq);
        setBookings(bk);
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [session]);

  const stats = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "Cancelled");
    const totalRevenue = active.reduce((sum, b) => sum + Number(b.total_amount), 0);
    const cancelledCount = bookings.length - active.length;

    // Bookings grouped per equipment, for the simple bar chart below.
    const perEquipment = {};
    active.forEach((b) => {
      perEquipment[b.equipment_name] = (perEquipment[b.equipment_name] || 0) + 1;
    });
    const rows = Object.entries(perEquipment)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const maxCount = rows.length ? rows[0].count : 0;
    const topEquipment = rows.length ? rows[0].name : "-";

    return {
      totalRevenue,
      totalBookings: bookings.length,
      activeBookings: active.length,
      cancelledCount,
      totalListed: equipmentList.length,
      rows,
      maxCount,
      topEquipment,
    };
  }, [bookings, equipmentList]);

  if (!session) {
    return <div className="loading-state">Loading...</div>;
  }

  return (
    <div className="screen">
      <div className="header-row">
        <Logo />
      </div>

      <div className="greeting">Business overview</div>
      <h1 className="hero-heading" style={{ fontSize: 22 }}>
        Your <span className="accent">analytics</span>
      </h1>

      {loading && <div className="loading-state">Loading analytics...</div>}
      {errorMsg && <div className="form-message error">{errorMsg}</div>}

      {!loading && !errorMsg && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-value">{formatCurrency(stats.totalRevenue)}</div>
              <div className="stat-label">Total revenue</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.activeBookings}</div>
              <div className="stat-label">Active bookings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalListed}</div>
              <div className="stat-label">Equipment listed</div>
            </div>
          </div>

          <div className="owner-card" style={{ marginBottom: 18 }}>
            <div className="owner-card-title" style={{ marginBottom: 8 }}>Summary</div>
            <div className="analytics-summary-row">
              <span>Total bookings (all time)</span>
              <strong>{stats.totalBookings}</strong>
            </div>
            <div className="analytics-summary-row">
              <span>Cancelled bookings</span>
              <strong>{stats.cancelledCount}</strong>
            </div>
            <div className="analytics-summary-row">
              <span>Most-rented equipment</span>
              <strong>{stats.topEquipment}</strong>
            </div>
          </div>

          <div className="section-header">
            <h2>Bookings by equipment</h2>
          </div>

          {stats.rows.length === 0 && (
            <div className="empty-state">No bookings yet — analytics will appear here once you have some.</div>
          )}

          {stats.rows.map((row) => (
            <div key={row.name} className="analytics-bar-row">
              <div className="analytics-bar-label">
                <span>{row.name}</span>
                <span>{row.count}</span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{ width: `${stats.maxCount ? (row.count / stats.maxCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </>
      )}

      <BottomNav role="seller" active="profile" />
    </div>
  );
}
