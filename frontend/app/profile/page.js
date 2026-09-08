"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
          const totalSpent = bookings
            .filter((b) => b.status !== "Cancelled")
            .reduce((sum, b) => sum + Number(b.total_amount), 0);
          setStats({
            totalBookings: bookings.length,
            totalSpent,
          });
        } else {
          const [equipmentList, bookings] = await Promise.all([
            getEquipmentList({ ownerId: session.user_id }),
            getBookings({ ownerId: session.user_id }),
          ]);
          const activeBookings = bookings.filter((b) => b.status !== "Cancelled");
          const cancelledCount = bookings.length - activeBookings.length;
          const cancellationRate = bookings.length ? cancelledCount / bookings.length : 0;
          const isTrusted = bookings.length >= 5 && cancellationRate <= 0.2;
          const uniqueCustomers = new Set(activeBookings.map((b) => b.customer_phone)).size;
          setStats({
            totalListed: equipmentList.length,
            totalRentedOut: activeBookings.length,
            uniqueCustomers,
            totalBookingsEver: bookings.length,
            isTrusted,
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

  function handleSignOut() {
    if (!confirm("Sign out of this account?")) return;
    clearSession();
    router.push("/start");
  }

  const isBuyer = session.role === "buyer";
  const hasGstin = !isBuyer && session.gstin;

  return (
    <div className="screen">
      <div className="header-row">
        <Logo />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
        <div className="profile-avatar">{session.name.trim().charAt(0).toUpperCase()}</div>
        <div className="profile-name">{session.name}</div>
        <div className="profile-phone">{session.phone}</div>
        {session.email && <div className="profile-phone">{session.email}</div>}
        <span className="status-pill green" style={{ marginTop: 8 }}>
          {isBuyer ? "Buyer account" : "Seller account"}
        </span>
        {hasGstin && <span className="gst-badge" style={{ marginTop: 8 }}>GST Verified</span>}
        {!isBuyer && stats?.isTrusted && (
          <span className="trusted-badge" style={{ marginTop: 8 }}>Trusted Seller</span>
        )}
      </div>

      <div className="owner-card" style={{ marginBottom: 18 }}>
        <div className="owner-card-title" style={{ marginBottom: 10 }}>
          {isBuyer ? "Your details" : "Business details"}
        </div>
        <div className="owner-card-sub" style={{ marginBottom: 6 }}>
          <strong>Address:</strong> {session.address || "-"}
        </div>
        {!isBuyer && (
          <>
            <div className="owner-card-sub" style={{ marginBottom: 6 }}>
              <strong>Business name:</strong> {session.business_name || "-"}
            </div>
            <div className="owner-card-sub">
              <strong>GSTIN:</strong> {session.gstin || "-"}
            </div>
          </>
        )}
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
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalListed}</div>
              <div className="stat-label">Equipment listed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalRentedOut}</div>
              <div className="stat-label">Active bookings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.uniqueCustomers}</div>
              <div className="stat-label">Unique customers</div>
            </div>
          </div>

          {!stats.isTrusted && (
            <div className="trust-progress-card">
              <div className="owner-card-sub">
                <strong>{stats.totalBookingsEver}/5</strong> bookings toward Trusted Seller status
                (needs 5+ bookings with a low cancellation rate).
              </div>
              <div className="trust-progress-bar">
                <div
                  className="trust-progress-fill"
                  style={{ width: `${Math.min(100, (stats.totalBookingsEver / 5) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <Link href="/sell/analytics" className="btn-secondary" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
            View analytics
          </Link>
        </>
      )}

      <button type="button" className="btn-secondary" style={{ marginTop: 24 }} onClick={handleSignOut}>
        Sign out
      </button>

      <BottomNav role={session.role} active="profile" />
    </div>
  );
}
