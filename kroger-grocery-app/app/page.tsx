"use client";

import { useEffect, useMemo, useState } from "react";
import { groceries, type GroceryItem } from "../data/groceries";

type SelectedItem = {
  id: string;
  name: string;
  section: string;
  quantity: number;
  inCart: boolean;
  isCustom?: boolean;
};

type AppMode = "build" | "shop";
type StoreName = "Kroger Hernando" | "Walmart Hernando" | "ALDI";

type SavedList = {
  name: string;
  items: SelectedItem[];
};

const theme = {
  pageBg: "#efe7da",
  panelBg: "#f8f3ea",
  panelAlt: "#f4ede1",
  border: "#d7c9b5",
  text: "#2f3a32",
  mutedText: "#6a756d",
  blue: "#5e7c88",
  blueDark: "#47636d",
  blueLight: "#d9e3e6",
  green: "#7f9a84",
  greenDark: "#5f7563",
  greenLight: "#e2ebe1",
  olive: "#9b9a6d",
  shadow: "0 10px 24px rgba(55, 45, 30, 0.08)",
  radius: 16,
};

const STORAGE_KEY = "compact-grocery-app-v1";
const SAVED_LISTS_KEY = "compact-grocery-saved-lists-v1";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalizeSection(item: GroceryItem | SelectedItem) {
  return item.section?.trim() || "Other";
}

export default function GroceryAppPage() {
  const [mode, setMode] = useState<AppMode>("build");
  const [store, setStore] = useState<StoreName>("Kroger Hernando");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [savedListName, setSavedListName] = useState("");
  const [loadListName, setLoadListName] = useState("");

  const [databaseOpen, setDatabaseOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [listOpen, setListOpen] = useState(true);

  const [databaseSection, setDatabaseSection] = useState("All");
  const [databaseSearch, setDatabaseSearch] = useState("");
  const [selectedDatabaseItem, setSelectedDatabaseItem] = useState("");

  const [customName, setCustomName] = useState("");
  const [customSection, setCustomSection] = useState("Custom");
  const [customQty, setCustomQty] = useState(1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedListsRaw = localStorage.getItem(SAVED_LISTS_KEY);

      if (saved) {
        setSelectedItems(JSON.parse(saved));
      }

      if (savedListsRaw) {
        setSavedLists(JSON.parse(savedListsRaw));
      }
    } catch (error) {
      console.error("Error loading saved grocery data:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedItems));
  }, [selectedItems]);

  useEffect(() => {
    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
  }, [savedLists]);

  const allSections = useMemo(() => {
    const dbSections = groceries.map((item) => normalizeSection(item));
    const customSections = selectedItems.map((item) => normalizeSection(item));
    return ["All", ...Array.from(new Set([...dbSections, ...customSections])).sort()];
  }, [selectedItems]);

  const databaseItems = useMemo(() => {
    return groceries
      .filter((item) => {
        const matchesSection =
          databaseSection === "All" || normalizeSection(item) === databaseSection;

        const matchesSearch =
          !databaseSearch.trim() ||
          item.name.toLowerCase().includes(databaseSearch.toLowerCase()) ||
          normalizeSection(item).toLowerCase().includes(databaseSearch.toLowerCase());

        return matchesSection && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [databaseSection, databaseSearch]);

  const listSections = useMemo(() => {
    const grouped: Record<string, SelectedItem[]> = {};

    selectedItems.forEach((item) => {
      const section = normalizeSection(item);
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(item);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, items]) => ({
        section,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [selectedItems]);

  const totalQuantity = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [selectedItems]);

  const inCartCount = useMemo(() => {
    return selectedItems.filter((item) => item.inCart).length;
  }, [selectedItems]);

  const progressPercent = useMemo(() => {
    if (selectedItems.length === 0) return 0;
    return Math.round((inCartCount / selectedItems.length) * 100);
  }, [inCartCount, selectedItems.length]);

  function addDatabaseItemByName(itemName: string) {
    const grocery = groceries.find((item) => item.name === itemName);
    if (!grocery) return;

    const existing = selectedItems.find(
      (item) => item.name.toLowerCase() === grocery.name.toLowerCase()
    );

    if (existing) {
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          id: `db-${slugify(grocery.name)}`,
          name: grocery.name,
          section: normalizeSection(grocery),
          quantity: 1,
          inCart: false,
        },
      ]);
    }

    setSelectedDatabaseItem("");
  }

  function addCustomItem() {
    if (!customName.trim()) return;

    const existing = selectedItems.find(
      (item) => item.name.toLowerCase() === customName.trim().toLowerCase()
    );

    if (existing) {
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + customQty }
            : item
        )
      );
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}`,
          name: customName.trim(),
          section: customSection.trim() || "Custom",
          quantity: customQty,
          inCart: false,
          isCustom: true,
        },
      ]);
    }

    setCustomName("");
    setCustomSection("Custom");
    setCustomQty(1);
    setCustomOpen(false);
  }

  function updateQuantity(id: string, change: number) {
    setSelectedItems((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(1, item.quantity + change) }
            : item
        )
        .filter(Boolean)
    );
  }

  function removeItem(id: string) {
    setSelectedItems((prev) => prev.filter((item) => item.id !== id));
  }

  function toggleInCart(id: string) {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, inCart: !item.inCart } : item
      )
    );
  }

  function clearCheckedItems() {
    setSelectedItems((prev) => prev.filter((item) => !item.inCart));
  }

  function clearEntireList() {
    setSelectedItems([]);
  }

  function saveCurrentList() {
    const name = savedListName.trim();
    if (!name || selectedItems.length === 0) return;

    const updated = savedLists.filter((list) => list.name !== name);
    updated.push({
      name,
      items: selectedItems,
    });

    setSavedLists(updated.sort((a, b) => a.name.localeCompare(b.name)));
    setSavedListName("");
  }

  function loadSavedList() {
    if (!loadListName) return;
    const found = savedLists.find((list) => list.name === loadListName);
    if (!found) return;
    setSelectedItems(found.items);
  }

  function deleteSavedList() {
    if (!loadListName) return;
    setSavedLists((prev) => prev.filter((list) => list.name !== loadListName));
    setLoadListName("");
  }

  function CompactSection({
    title,
    open,
    onToggle,
    children,
  }: {
    title: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) {
    return (
      <div
        style={{
          background: theme.panelBg,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius,
          boxShadow: theme.shadow,
          overflow: "hidden",
        }}
      >
        <button
          onClick={onToggle}
          style={{
            width: "100%",
            border: "none",
            background: theme.panelAlt,
            color: theme.text,
            padding: "12px 14px",
            fontSize: 14,
            fontWeight: 700,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <span>{title}</span>
          <span style={{ fontSize: 12, color: theme.mutedText }}>
            {open ? "Hide" : "Show"}
          </span>
        </button>
        {open && <div style={{ padding: 14 }}>{children}</div>}
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: theme.pageBg,
        color: theme.text,
        padding: "18px 14px 34px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            background: theme.panelBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 20,
            boxShadow: theme.shadow,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  lineHeight: 1.1,
                }}
              >
                Grocery List App
              </h1>
              <p
                style={{
                  margin: "6px 0 0",
                  color: theme.mutedText,
                  fontSize: 13,
                }}
              >
                Compact mode with dropdown controls
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => setMode("build")}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  background: mode === "build" ? theme.blue : theme.blueLight,
                  color: mode === "build" ? "white" : theme.blueDark,
                  cursor: "pointer",
                }}
              >
                Build
              </button>
              <button
                onClick={() => setMode("shop")}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  background: mode === "shop" ? theme.green : theme.greenLight,
                  color: mode === "shop" ? "white" : theme.greenDark,
                  cursor: "pointer",
                }}
              >
                Shop
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
              marginTop: 14,
            }}
          >
            <div
              style={{
                background: theme.panelAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 11, color: theme.mutedText }}>Store</div>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value as StoreName)}
                style={inputStyle}
              >
                <option>Kroger Hernando</option>
                <option>Walmart Hernando</option>
                <option>ALDI</option>
              </select>
            </div>

            <div
              style={{
                background: theme.panelAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 11, color: theme.mutedText }}>Items</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {selectedItems.length}
              </div>
            </div>

            <div
              style={{
                background: theme.panelAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 11, color: theme.mutedText }}>
                Total Qty
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{totalQuantity}</div>
            </div>

            <div
              style={{
                background: theme.panelAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 11, color: theme.mutedText }}>In Cart</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {inCartCount}
              </div>
            </div>
          </div>

          {mode === "shop" && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 6,
                  color: theme.mutedText,
                }}
              >
                <span>Trip progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div
                style={{
                  height: 10,
                  background: theme.blueLight,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    background: theme.blue,
                    borderRadius: 999,
                    transition: "width 0.25s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <CompactSection
          title="Grocery Database"
          open={databaseOpen}
          onToggle={() => setDatabaseOpen((prev) => !prev)}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <div>
              <label style={labelStyle}>Section</label>
              <select
                value={databaseSection}
                onChange={(e) => setDatabaseSection(e.target.value)}
                style={inputStyle}
              >
                {allSections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Search</label>
              <input
                value={databaseSearch}
                onChange={(e) => setDatabaseSearch(e.target.value)}
                placeholder="Search groceries..."
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Choose Grocery Item</label>
              <select
                value={selectedDatabaseItem}
                onChange={(e) => setSelectedDatabaseItem(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select an item...</option>
                {databaseItems.map((item) => (
                  <option key={`${item.name}-${item.section}`} value={item.name}>
                    {item.name} — {normalizeSection(item)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button
                onClick={() => addDatabaseItemByName(selectedDatabaseItem)}
                style={primaryButtonStyle}
              >
                Add Item
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: theme.mutedText,
            }}
          >
            Showing {databaseItems.length} grocery items
          </div>
        </CompactSection>

        <CompactSection
          title="Quick Actions"
          open={actionsOpen}
          onToggle={() => setActionsOpen((prev) => !prev)}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <div>
              <label style={labelStyle}>Save current list</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={savedListName}
                  onChange={(e) => setSavedListName(e.target.value)}
                  placeholder="List name"
                  style={inputStyle}
                />
                <button onClick={saveCurrentList} style={secondaryButtonStyle}>
                  Save
                </button>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Load saved list</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={loadListName}
                  onChange={(e) => setLoadListName(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select a saved list...</option>
                  {savedLists.map((list) => (
                    <option key={list.name} value={list.name}>
                      {list.name}
                    </option>
                  ))}
                </select>
                <button onClick={loadSavedList} style={secondaryButtonStyle}>
                  Load
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <button onClick={deleteSavedList} style={secondaryButtonStyle}>
                Delete Saved
              </button>
              <button onClick={clearCheckedItems} style={secondaryButtonStyle}>
                Clear Checked
              </button>
              <button onClick={clearEntireList} style={dangerButtonStyle}>
                Clear All
              </button>
            </div>
          </div>
        </CompactSection>

        <CompactSection
          title="Add Custom Grocery Item"
          open={customOpen}
          onToggle={() => setCustomOpen((prev) => !prev)}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <div>
              <label style={labelStyle}>Item name</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ex: Ribeye steak"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Section</label>
              <input
                value={customSection}
                onChange={(e) => setCustomSection(e.target.value)}
                placeholder="Ex: Meat"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number"
                min={1}
                value={customQty}
                onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value) || 1))}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={addCustomItem} style={primaryButtonStyle}>
                Add Custom Item
              </button>
            </div>
          </div>
        </CompactSection>

        <CompactSection
          title={mode === "build" ? "Current Grocery List" : "Shopping List"}
          open={listOpen}
          onToggle={() => setListOpen((prev) => !prev)}
        >
          {selectedItems.length === 0 ? (
            <div
              style={{
                padding: 16,
                border: `1px dashed ${theme.border}`,
                borderRadius: 14,
                color: theme.mutedText,
                textAlign: "center",
                background: theme.panelAlt,
                fontSize: 13,
              }}
            >
              No items yet. Add from the grocery database or create a custom item.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {listSections.map(({ section, items }) => (
                <div
                  key={section}
                  style={{
                    background: theme.panelAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 12px",
                      fontWeight: 800,
                      fontSize: 13,
                      borderBottom: `1px solid ${theme.border}`,
                    }}
                  >
                    {section}
                  </div>

                  <div style={{ display: "grid" }}>
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            mode === "shop"
                              ? "1fr auto auto auto"
                              : "1fr auto auto",
                          gap: 8,
                          alignItems: "center",
                          padding: "10px 12px",
                          borderTop:
                            index === 0 ? "none" : `1px solid ${theme.border}`,
                          opacity: mode === "shop" && item.inCart ? 0.55 : 1,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              textDecoration:
                                mode === "shop" && item.inCart
                                  ? "line-through"
                                  : "none",
                            }}
                          >
                            {item.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: theme.mutedText,
                              marginTop: 2,
                            }}
                          >
                            Qty {item.quantity}
                            {item.isCustom ? " • Custom" : ""}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            style={miniButtonStyle}
                          >
                            −
                          </button>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            style={miniButtonStyle}
                          >
                            +
                          </button>
                        </div>

                        {mode === "shop" && (
                          <button
                            onClick={() => toggleInCart(item.id)}
                            style={{
                              ...miniButtonStyle,
                              background: item.inCart
                                ? theme.green
                                : theme.greenLight,
                              color: item.inCart ? "white" : theme.greenDark,
                              minWidth: 74,
                            }}
                          >
                            {item.inCart ? "Checked" : "Check"}
                          </button>
                        )}

                        <button
                          onClick={() => removeItem(item.id)}
                          style={{
                            ...miniButtonStyle,
                            background: "#f3d9d9",
                            color: "#7d3d3d",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CompactSection>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#6a756d",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d7c9b5",
  background: "white",
  color: "#2f3a32",
  fontSize: 13,
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#5e7c88",
  color: "white",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#d9e3e6",
  color: "#47636d",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#f3d9d9",
  color: "#7d3d3d",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const miniButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  background: "#e8e1d5",
  color: "#2f3a32",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
