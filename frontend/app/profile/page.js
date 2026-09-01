"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBookings, getEquipmentList } from "@/lib/api";
import { getSession, clearSession } from "@/lib/session";
import { formatCurrency } from "@/lib/display";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSessionState] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/start");
      return;
    }
    setSessionState(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;

    async function loadStats() {
      setLoading(true);
      try {
        if (session.role === "buyer") {
          const bookings = await getBookings({ phone: session.phone });
          const totalSpent = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
          setStats({
            totalBookings: bookings.length,
            totalSpent,
          });
        } else {
          const [equipmentList, bookings] = await Promise.all([
            getEquipmentList({ ownerId: session.user_id }),
            getBookings({ ownerId: session.user_id }),
          ]);
          const uniqueCustomers = new Set(bookings.map((b) => b.customer_phone)).size;
          setStats({
            totalListed: equipmentList.length,
            totalRentedOut: bookings.length,
            uniqueCustomers,
          });
        }
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [session]);

  if (!session) {
    return <div className="loading-state">Loading...</div>;
  }

  function handleSwitchRole() {
    if (!confirm("Switch role? You'll need to re-enter your name and phone number.")) return;
    clearSession();
    router.push("/start");
  }

  const isBuyer = session.role === "buyer";

  return (
    <div className="screen">
      <div className="header-row">
        <Logo />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
        <div className="profile-avatar">{session.name.trim().charAt(0).toUpperCase()}</div>
        <div className="profile-name">{session.name}</div>
        <div className="profile-phone">{session.phone}</div>
        <span className="status-pill green" style={{ marginTop: 8 }}>
          {isBuyer ? "Buyer account" : "Seller account"}
        </span>
      </div>

      {loading && <div className="loading-state">Loading stats...</div>}

      {!loading && stats && isBuyer && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalBookings}</div>
            <div className="stat-label">Total bookings</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCurrency(stats.totalSpent)}</div>
            <div className="stat-label">Total spent</div>
          </div>
        </div>
      )}

      {!loading && stats && !isBuyer && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalListed}</div>
            <div className="stat-label">Equipment listed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalRentedOut}</div>
            <div className="stat-label">Times rented out</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.uniqueCustomers}</div>
            <div className="stat-label">Unique customers</div>
          </div>
        </div>
      )}

      <button type="button" className="btn-secondary" style={{ marginTop: 24 }} onClick={handleSwitchRole}>
        Switch role / Sign out
      </button>

      <BottomNav role={session.role} active="profile" />
    </div>
  );
}
