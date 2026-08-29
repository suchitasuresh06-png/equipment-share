"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEquipmentList } from "@/lib/api";
import { getSession } from "@/lib/session";
import CategoryFilter from "@/components/CategoryFilter";
import SearchBar from "@/components/SearchBar";
import EquipmentCard from "@/components/EquipmentCard";
import BottomNav from "@/components/BottomNav";
import BookingForm from "@/components/BookingForm";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";

function greetingWord() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function RentHomePage() {
  const router = useRouter();
  const [session, setLocalSession] = useState(null);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookingEquipment, setBookingEquipment] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/start");
      return;
    }
    if (s.role !== "buyer") {
      router.replace("/sell");
      return;
    }
    setLocalSession(s);
  }, [router]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getEquipmentList({ category, search });
      setEquipmentList(data);
      setLastUpdated(new Date());
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, category, search]);

  if (!session) {
    return <div className="loading-state">Loading...</div>;
  }

  // Available machines first, then whatever's currently rented.
  const sorted = [...equipmentList].sort((a, b) => {
    if (a.availability === b.availability) return 0;
    return a.availability === "Available" ? -1 : 1;
  });

  function handleSuggestionClick() {
    setSearchOpen(true);
    setSearch("mobile generator");
  }

  function minutesAgo() {
    if (!lastUpdated) return "";
    const mins = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000));
    return mins === 0 ? "just now" : `${mins} min${mins > 1 ? "s" : ""} ago`;
  }

  return (
    <div className="screen">
      <div className="header-row">
        <Logo />
        <div className="header-icons">
          <button type="button" className="icon-btn" onClick={() => setSearchOpen((v) => !v)} aria-label="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
          </button>
          <NotificationBell />
        </div>
      </div>

      <div className="greeting">Hey {session.name.split(" ")[0]}, {greetingWord()}</div>
      <h1 className="hero-heading">
        Find your <span className="accent">next machine</span>, rented in minutes.
      </h1>

      <button type="button" className="suggestion-pill" onClick={handleSuggestionClick}>
        <span className="suggestion-pill-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </span>
        <span className="suggestion-pill-text">Search for &ldquo;mobile generator&rdquo;</span>
      </button>

      {searchOpen && <SearchBar value={search} onChange={setSearch} autoFocus />}

      <CategoryFilter selected={category} onSelect={setCategory} />

      <div className="section-header">
        <h2>Browse equipment</h2>
        <span className="count">{sorted.length} machines</span>
      </div>

      {loading && <div className="loading-state">Loading equipment...</div>}

      {!loading && errorMsg && (
        <div className="form-message error">
          Couldn&apos;t load equipment: {errorMsg}. Make sure the backend is running on the URL set in
          NEXT_PUBLIC_API_URL.
        </div>
      )}

      {!loading && !errorMsg && sorted.length === 0 && (
        <div className="empty-state">No equipment matches your search right now. Try a different category or keyword.</div>
      )}

      {!loading && !errorMsg && sorted.length > 0 && (
        <div className="equipment-list">
          {sorted.map((item) => (
            <EquipmentCard
              key={item.equipment_id}
              equipment={item}
              onOpen={(eq) => router.push(`/equipment/${eq.equipment_id}`)}
              onRent={(eq) => setBookingEquipment(eq)}
            />
          ))}
        </div>
      )}

      {!loading && lastUpdated && <div className="updated-footer">last updated {minutesAgo()}</div>}

      {bookingEquipment && (
        <BookingForm
          equipment={bookingEquipment}
          buyer={{ name: session.name, phone: session.phone }}
          onClose={() => setBookingEquipment(null)}
          onSuccess={() => {
            setBookingEquipment(null);
            load();
          }}
        />
      )}

      <BottomNav role="buyer" active="rent" />
    </div>
  );
}
