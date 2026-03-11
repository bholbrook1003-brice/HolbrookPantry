"use client";

import { useEffect, useMemo, useState } from "react";
import { groceries, type GroceryItem } from "../data/groceries";

type SelectedItem = {
  name: string;
  section: string;
  quantity: number;
  inCart: boolean;
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
  olive: "#9b9b6f",
  tan: "#c6b59a",
  warmDark: "#5b4d3f",
  danger: "#9d5c57",
  gold: "#c4a56a",
  white: "#fffdf9",
  shadow: "0 8px 20px rgba(73, 58, 39, 0.08)",
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>("build");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [hideInCart, setHideInCart] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState("All");
  const [selectedStore, setSelectedStore] = useState<StoreName>("Kroger Hernando");
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [newListName, setNewListName] = useState("");

  function getItemSectionForStore(item: GroceryItem, store: StoreName) {
    return item.sections[store];
  }

  function normalizeSelectedItems(items: SelectedItem[], store: StoreName): SelectedItem[] {
    return items
      .map((item) => {
        const match = groceries.find((g) => g.name === item.name);
        if (!match) return item;

        return {
          ...item,
          section: getItemSectionForStore(match, store),
          quantity: Math.max(1, Number(item.quantity) || 1),
          inCart: Boolean(item.inCart),
        };
      })
      .filter((item) => typeof item.name === "string" && typeof item.section === "string");
  }

  useEffect(() => {
    const savedItems = safeParse<SelectedItem[]>(
      localStorage.getItem("grocerySelectedItems"),
      []
    );
    setSelectedItems(savedItems);

    const savedFavorites = safeParse<string[]>(
      localStorage.getItem("groceryFavorites"),
      []
    );
    setFavoriteItems(savedFavorites);

    const savedSection = localStorage.getItem("grocerySelectedSection");
    if (savedSection) setSelectedSection(savedSection);

    const savedStore = localStorage.getItem("grocerySelectedStore");
    if (
      savedStore === "Kroger Hernando" ||
      savedStore === "Walmart Hernando" ||
      savedStore === "ALDI"
    ) {
      setSelectedStore(savedStore);
    }

    const savedReusableLists = safeParse<SavedList[]>(
      localStorage.getItem("grocerySavedLists"),
      []
    );
    setSavedLists(savedReusableLists);

    const savedMode = localStorage.getItem("groceryAppMode");
    if (savedMode === "build" || savedMode === "shop") {
      setAppMode(savedMode);
    }
  }, []);

  useEffect(() => {
    loadTripFromUrl();
  }, []);

  useEffect(() => {
    localStorage.setItem("grocerySavedLists", JSON.stringify(savedLists));
  }, [savedLists]);

  useEffect(() => {
    localStorage.setItem("grocerySelectedItems", JSON.stringify(selectedItems));
  }, [selectedItems]);

  useEffect(() => {
    localStorage.setItem("groceryFavorites", JSON.stringify(favoriteItems));
  }, [favoriteItems]);

  useEffect(() => {
    localStorage.setItem("grocerySelectedStore", selectedStore);
  }, [selectedStore]);

  useEffect(() => {
    localStorage.setItem("groceryAppMode", appMode);
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem("grocerySelectedSection", selectedSection);
  }, [selectedSection]);

  useEffect(() => {
    setSelectedItems((prev) => normalizeSelectedItems(prev, selectedStore));
  }, [selectedStore]);

  async function createShareLink() {
    try {
      const payload = encodeURIComponent(
        btoa(
          JSON.stringify({
            selectedItems,
            selectedStore,
          })
        )
      );

      const url = `${window.location.origin}${window.location.pathname}?trip=${payload}`;
      await navigator.clipboard.writeText(url);
      alert("Share link copied to clipboard");
    } catch {
      alert("Could not copy the share link");
    }
  }

  function loadTripFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const trip = params.get("trip");
    if (!trip) return;

    try {
      const parsed = JSON.parse(atob(decodeURIComponent(trip)));

      if (Array.isArray(parsed.selectedItems)) {
        const cleanedItems = parsed.selectedItems.filter(
          (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as SelectedItem).name === "string" &&
            typeof (item as SelectedItem).section === "string" &&
            typeof (item as SelectedItem).quantity === "number" &&
            typeof (item as SelectedItem).inCart === "boolean"
        ) as SelectedItem[];

        setSelectedItems(normalizeSelectedItems(cleanedItems, parsed.selectedStore || selectedStore));
      }

      if (
        parsed.selectedStore === "Kroger Hernando" ||
        parsed.selectedStore === "Walmart Hernando" ||
        parsed.selectedStore === "ALDI"
      ) {
        setSelectedStore(parsed.selectedStore);
      }
    } catch (error) {
      console.error("Invalid trip link", error);
    }
  }

  function getItemSection(item: GroceryItem) {
    return item.sections[selectedStore];
  }

  function resetCompletedItems() {
    setSelectedItems((prev) =>
      prev.map((item) => ({
        ...item,
        inCart: false,
      }))
    );
  }

  function clearSearchAndFilters() {
    setSearchText("");
    setSelectedSection("All");
  }

  function saveCurrentList() {
    const trimmedName = newListName.trim();
    if (!trimmedName || selectedItems.length === 0) return;

    const newSavedList: SavedList = {
      name: trimmedName,
      items: selectedItems,
    };

    setSavedLists((prev) => {
      const existingIndex = prev.findIndex(
        (list) => list.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newSavedList;
        return updated;
      }

      return [...prev, newSavedList];
    });

    setNewListName("");
  }

  function loadSavedList(list: SavedList) {
    setSelectedItems(normalizeSelectedItems(list.items, selectedStore));
    setAppMode("build");
  }

  function deleteSavedList(listName: string) {
    setSavedLists((prev) => prev.filter((list) => list.name !== listName));
  }

  function removeEntireItem(itemName: string) {
    setSelectedItems((prev) => prev.filter((item) => item.name !== itemName));
  }

  function addItem(item: GroceryItem) {
    const itemSection = getItemSection(item);

    setSelectedItems((prev) => {
      const existingItem = prev.find((selected) => selected.name === item.name);

      if (existingItem) {
        return prev.map((selected) =>
          selected.name === item.name
            ? { ...selected, quantity: selected.quantity + 1 }
            : selected
        );
      }

      return [
        ...prev,
        {
          name: item.name,
          section: itemSection,
          quantity: 1,
          inCart: false,
        },
      ];
    });
  }

  function increaseQuantity(itemName: string) {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.name === itemName ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseQuantity(itemName: string) {
    setSelectedItems((prev) =>
      prev
        .map((item) =>
          item.name === itemName ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function toggleInCart(itemName: string) {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.name === itemName ? { ...item, inCart: !item.inCart } : item
      )
    );
  }

  function toggleFavorite(itemName: string) {
    setFavoriteItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  }

  const mealSuggestions: Record<string, string[]> = {
    Spaghetti: ["Tomato Sauce", "Parmesan", "Garlic Bread"],
    Penne: ["Tomato Sauce", "Parmesan", "Garlic Bread"],
    "Ground Beef": ["Tortillas", "Shredded Cheddar", "Salsa", "Sour Cream"],
    "Chicken Breasts": ["Rice", "Broccoli", "Butter"],
    Eggs: ["Bacon", "Bread", "Butter"],
    "Frozen Pizza": ["Salad", "Ranch Dressing"],
  };

  const filteredGroceries = useMemo(() => {
    return groceries.filter((item) => {
      const itemSection = getItemSection(item);
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchText.toLowerCase());
      const matchesSection =
        selectedSection === "All" || itemSection === selectedSection;

      return matchesSearch && matchesSection;
    });
  }, [searchText, selectedSection, selectedStore]);

  const favoriteGroceries = useMemo(
    () => groceries.filter((item) => favoriteItems.includes(item.name)),
    [favoriteItems]
  );

  const suggestedItems = Array.from(
    new Set(
      selectedItems.flatMap((selected) => mealSuggestions[selected.name] || [])
    )
  )
    .filter((name) => !selectedItems.some((item) => item.name === name))
    .map((name) => groceries.find((g) => g.name === name))
    .filter(Boolean) as GroceryItem[];

  const sections = useMemo(
    () => ["All", ...Array.from(new Set(groceries.map((item) => getItemSection(item))))],
    [selectedStore]
  );

  const stores: StoreName[] = ["Kroger Hernando", "Walmart Hernando", "ALDI"];

  const quickAddItems = [
    "Milk",
    "Eggs",
    "Bread",
    "Bananas",
    "Chicken Breasts",
    "Ground Beef",
    "Shredded Cheddar",
    "Apples",
  ];

  const storeSectionOrder: Record<StoreName, string[]> = {
    "Kroger Hernando": [
      "Produce",
      "Bakery",
      "Deli",
      "Meat",
      "Dairy",
      "Frozen",
      "Breakfast",
      "Pantry",
      "Pasta & Rice",
      "Canned Goods",
      "Snacks",
      "Beverages",
      "Condiments",
      "Spices & Baking",
      "Cleaning Supplies",
      "Paper Goods",
      "Personal Care",
      "Pharmacy",
      "Pet Supplies",
    ],
    "Walmart Hernando": [
      "Produce",
      "Bakery",
      "Meat",
      "Dairy",
      "Frozen",
      "Breakfast",
      "Pantry",
      "Snacks",
      "Beverages",
      "Condiments",
      "Spices & Baking",
      "Cleaning Supplies",
      "Paper Goods",
      "Personal Care",
      "Pharmacy",
      "Pet Supplies",
    ],
    ALDI: [
      "Produce",
      "Bakery",
      "Meat",
      "Dairy",
      "Frozen",
      "Pantry",
      "Snacks",
      "Beverages",
      "Cleaning Supplies",
      "Paper Goods",
    ],
  };

  const storeMapLayouts: Record<
    StoreName,
    { section: string; x: string; y: string; width: string; height: string }[]
  > = {
    "Kroger Hernando": [
      { section: "Produce", x: "5%", y: "8%", width: "22%", height: "18%" },
      { section: "Bakery", x: "30%", y: "8%", width: "18%", height: "14%" },
      { section: "Deli", x: "50%", y: "8%", width: "18%", height: "14%" },
      { section: "Meat", x: "70%", y: "8%", width: "22%", height: "18%" },
      { section: "Dairy", x: "70%", y: "32%", width: "22%", height: "20%" },
      { section: "Frozen", x: "45%", y: "32%", width: "20%", height: "20%" },
      { section: "Breakfast", x: "20%", y: "32%", width: "20%", height: "12%" },
      { section: "Pantry", x: "20%", y: "48%", width: "20%", height: "16%" },
      { section: "Pasta & Rice", x: "42%", y: "56%", width: "16%", height: "12%" },
      { section: "Canned Goods", x: "60%", y: "56%", width: "16%", height: "12%" },
      { section: "Snacks", x: "5%", y: "48%", width: "12%", height: "12%" },
      { section: "Beverages", x: "5%", y: "64%", width: "18%", height: "12%" },
      { section: "Cleaning Supplies", x: "25%", y: "68%", width: "22%", height: "12%" },
      { section: "Paper Goods", x: "50%", y: "72%", width: "18%", height: "10%" },
      { section: "Personal Care", x: "70%", y: "72%", width: "20%", height: "10%" },
    ],
    "Walmart Hernando": [
      { section: "Produce", x: "5%", y: "8%", width: "20%", height: "18%" },
      { section: "Bakery", x: "28%", y: "8%", width: "16%", height: "14%" },
      { section: "Meat", x: "72%", y: "8%", width: "20%", height: "18%" },
      { section: "Dairy", x: "72%", y: "30%", width: "20%", height: "18%" },
      { section: "Frozen", x: "50%", y: "30%", width: "18%", height: "18%" },
      { section: "Breakfast", x: "25%", y: "30%", width: "18%", height: "12%" },
      { section: "Pantry", x: "25%", y: "46%", width: "18%", height: "16%" },
      { section: "Snacks", x: "5%", y: "46%", width: "16%", height: "12%" },
      { section: "Beverages", x: "5%", y: "62%", width: "18%", height: "12%" },
      { section: "Cleaning Supplies", x: "28%", y: "66%", width: "20%", height: "12%" },
      { section: "Paper Goods", x: "52%", y: "66%", width: "18%", height: "12%" },
      { section: "Pharmacy", x: "74%", y: "66%", width: "16%", height: "12%" },
    ],
    ALDI: [
      { section: "Produce", x: "8%", y: "10%", width: "22%", height: "18%" },
      { section: "Bakery", x: "34%", y: "10%", width: "18%", height: "14%" },
      { section: "Meat", x: "56%", y: "10%", width: "18%", height: "16%" },
      { section: "Dairy", x: "76%", y: "10%", width: "16%", height: "16%" },
      { section: "Frozen", x: "64%", y: "34%", width: "28%", height: "16%" },
      { section: "Pantry", x: "34%", y: "34%", width: "24%", height: "16%" },
      { section: "Snacks", x: "8%", y: "34%", width: "20%", height: "14%" },
      { section: "Beverages", x: "8%", y: "54%", width: "22%", height: "14%" },
      { section: "Cleaning Supplies", x: "34%", y: "56%", width: "24%", height: "12%" },
      { section: "Paper Goods", x: "62%", y: "56%", width: "24%", height: "12%" },
    ],
  };

  const visibleSelectedItems = hideInCart
    ? selectedItems.filter((item) => !item.inCart)
    : selectedItems;

  const sectionOrder = storeSectionOrder[selectedStore];
  const currentMapLayout = storeMapLayouts[selectedStore];

  const groupedItems: { [key: string]: SelectedItem[] } = {};
  visibleSelectedItems.forEach((item) => {
    if (!groupedItems[item.section]) groupedItems[item.section] = [];
    groupedItems[item.section].push(item);
  });

  const remainingWalkSections = sectionOrder.filter((section) =>
    selectedItems.some(
      (item) => item.section === section && item.inCart === false
    )
  );

  const nextStopSection =
    remainingWalkSections.length > 0 ? remainingWalkSections[0] : null;

  const totalUniqueItems = selectedItems.length;
  const totalQuantity = selectedItems.reduce((total, item) => total + item.quantity, 0);
  const totalInCartItems = selectedItems.filter((item) => item.inCart).length;
  const tripProgress =
    totalUniqueItems === 0
      ? 0
      : Math.round((totalInCartItems / totalUniqueItems) * 100);

  const currentSectionItems = nextStopSection
    ? groupedItems[nextStopSection] || []
    : [];

  const compactButtonStyle = {
    padding: "8px 12px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700 as const,
    fontSize: "13px",
    lineHeight: 1.1,
  };

  return (
    <main
      style={{
        padding: "18px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background:
          "linear-gradient(180deg, #efe7da 0%, #e8decd 45%, #e2d6c1 100%)",
        minHeight: "100vh",
        color: theme.text,
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "32px",
                lineHeight: 1.1,
                margin: 0,
                color: theme.warmDark,
                letterSpacing: "-0.02em",
              }}
            >
              Pantry Path
            </h1>
            <div
              style={{
                fontSize: "13px",
                color: theme.mutedText,
                marginTop: "4px",
              }}
            >
              Family grocery planning and in-store route guide
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <label style={{ fontWeight: 700, color: theme.warmDark, fontSize: "14px" }}>
              Store:
            </label>

            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value as StoreName)}
              style={{
                padding: "8px 10px",
                borderRadius: "10px",
                border: `1px solid ${theme.border}`,
                fontSize: "14px",
                backgroundColor: theme.white,
                color: theme.text,
              }}
            >
              {stores.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>

            <button
              onClick={() => setAppMode("build")}
              style={{
                ...compactButtonStyle,
                backgroundColor: appMode === "build" ? theme.blue : theme.panelBg,
                color: appMode === "build" ? theme.white : theme.text,
                boxShadow: theme.shadow,
              }}
            >
              Build List
            </button>

            <button
              onClick={() => setAppMode("shop")}
              style={{
                ...compactButtonStyle,
                backgroundColor: appMode === "shop" ? theme.greenDark : theme.panelBg,
                color: appMode === "shop" ? theme.white : theme.text,
                boxShadow: theme.shadow,
              }}
            >
              Shop Mode
            </button>

            <button
              onClick={() => setHideInCart(!hideInCart)}
              style={{
                ...compactButtonStyle,
                backgroundColor: hideInCart ? theme.blueDark : theme.tan,
                color: theme.white,
              }}
            >
              {hideInCart ? "Show In Cart" : "Hide In Cart"}
            </button>

            <button
              onClick={resetCompletedItems}
              style={{
                ...compactButtonStyle,
                backgroundColor: theme.olive,
                color: theme.white,
              }}
            >
              Reset Completed
            </button>

            <button
              onClick={() => setSelectedItems([])}
              style={{
                ...compactButtonStyle,
                backgroundColor: theme.warmDark,
                color: theme.white,
              }}
            >
              Clear Trip
            </button>

            <button
              onClick={createShareLink}
              style={{
                ...compactButtonStyle,
                backgroundColor: theme.blue,
                color: theme.white,
              }}
            >
              Share Trip
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          {[
            ["Different Items", totalUniqueItems],
            ["Total Quantity", totalQuantity],
            ["In Cart", totalInCartItems],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                backgroundColor: theme.panelBg,
                padding: "12px 14px",
                borderRadius: "12px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: theme.mutedText,
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: theme.warmDark,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: theme.panelBg,
              padding: "16px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadow,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: theme.mutedText,
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Next Stop
            </div>

            {selectedItems.length === 0 ? (
              <div style={{ fontSize: "22px", fontWeight: 800, color: theme.mutedText }}>
                No Items Yet
              </div>
            ) : nextStopSection ? (
              <div style={{ fontSize: "26px", fontWeight: 800, color: theme.blueDark }}>
                {nextStopSection}
              </div>
            ) : (
              <div style={{ fontSize: "22px", fontWeight: 800, color: theme.greenDark }}>
                Trip Complete
              </div>
            )}
          </div>

          <div
            style={{
              backgroundColor: theme.panelBg,
              padding: "16px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadow,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: theme.mutedText,
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Trip Progress
            </div>

            <div
              style={{
                width: "100%",
                height: "12px",
                backgroundColor: "#ddd5c8",
                borderRadius: "999px",
                overflow: "hidden",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: `${tripProgress}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${theme.green} 0%, ${theme.blue} 100%)`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div style={{ fontSize: "13px", color: theme.mutedText }}>
              {totalInCartItems} of {totalUniqueItems} items done
            </div>
          </div>
        </div>

        {totalUniqueItems > 0 && tripProgress === 100 && (
          <div
            style={{
              backgroundColor: theme.greenLight,
              border: `1px solid ${theme.green}`,
              color: theme.greenDark,
              padding: "14px",
              borderRadius: "14px",
              boxShadow: theme.shadow,
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: 800, marginBottom: "4px" }}>
              🎉 Trip Complete
            </div>
            <div style={{ fontSize: "13px", color: theme.mutedText }}>
              All items have been collected.
            </div>
          </div>
        )}

        {appMode === "build" && (
          <div
            style={{
              backgroundColor: theme.panelBg,
              padding: "16px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadow,
              marginBottom: "16px",
            }}
          >
            <h2 style={{ margin: "0 0 12px", color: theme.warmDark, fontSize: "22px" }}>
              Saved Lists
            </h2>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "12px",
              }}
            >
              <input
                type="text"
                placeholder="Name this list..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                style={{
                  flex: "1 1 220px",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.white,
                  color: theme.text,
                  fontSize: "14px",
                }}
              />

              <button
                onClick={saveCurrentList}
                style={{
                  ...compactButtonStyle,
                  backgroundColor: theme.greenDark,
                  color: theme.white,
                }}
              >
                Save Current List
              </button>
            </div>

            <div style={{ fontSize: "12px", color: theme.mutedText, marginTop: "6px" }}>
              Saving with the same name will update the old list.
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginTop: "12px",
              }}
            >
              {savedLists.length === 0 ? (
                <div style={{ color: theme.mutedText }}>No saved lists yet.</div>
              ) : (
                savedLists.map((list) => (
                  <div
                    key={list.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                      backgroundColor: theme.white,
                      border: `1px solid ${theme.border}`,
                      borderRadius: "12px",
                      padding: "10px 12px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: theme.text }}>{list.name}</div>
                      <div style={{ fontSize: "12px", color: theme.mutedText }}>
                        {list.items.length} items
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => loadSavedList(list)}
                        style={{
                          ...compactButtonStyle,
                          backgroundColor: theme.blueDark,
                          color: theme.white,
                        }}
                      >
                        Load
                      </button>

                      <button
                        onClick={() => deleteSavedList(list.name)}
                        style={{
                          ...compactButtonStyle,
                          backgroundColor: theme.danger,
                          color: theme.white,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {appMode === "build" && (
          <div
            style={{
              backgroundColor: theme.panelBg,
              padding: "16px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadow,
              marginBottom: "16px",
            }}
          >
            <h2 style={{ margin: "0 0 12px", color: theme.warmDark, fontSize: "22px" }}>
              Quick Add
            </h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {quickAddItems.map((itemName) => {
                const groceryItem = groceries.find((item) => item.name === itemName);
                if (!groceryItem) return null;

                return (
                  <button
                    key={itemName}
                    onClick={() => addItem(groceryItem)}
                    style={{
                      ...compactButtonStyle,
                      borderRadius: "999px",
                      backgroundColor: theme.blueLight,
                      color: theme.blueDark,
                    }}
                  >
                    + {itemName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {appMode === "build" && suggestedItems.length > 0 && (
          <div
            style={{
              backgroundColor: theme.panelBg,
              padding: "16px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadow,
              marginBottom: "16px",
            }}
          >
            <h2 style={{ margin: "0 0 12px", color: theme.warmDark, fontSize: "22px" }}>
              Suggested Add-Ons
            </h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {suggestedItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => addItem(item)}
                  style={{
                    ...compactButtonStyle,
                    borderRadius: "999px",
                    backgroundColor: theme.greenLight,
                    color: theme.greenDark,
                  }}
                >
                  + {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {appMode === "build" && favoriteGroceries.length > 0 && (
          <div
            style={{
              backgroundColor: theme.panelBg,
              padding: "16px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadow,
              marginBottom: "16px",
            }}
          >
            <h2 style={{ margin: "0 0 12px", color: theme.warmDark, fontSize: "22px" }}>
              Favorite Items
            </h2>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {favoriteGroceries.map((item) => (
                <button
                  key={item.name}
                  onClick={() => addItem(item)}
                  style={{
                    ...compactButtonStyle,
                    borderRadius: "999px",
                    backgroundColor: theme.gold,
                    color: theme.warmDark,
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {appMode === "build" && (
            <div
              style={{
                backgroundColor: theme.panelBg,
                padding: "16px",
                borderRadius: "14px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
                maxHeight: "75vh",
                overflowY: "auto",
              }}
            >
              <h2 style={{ margin: "0 0 12px", color: theme.warmDark, fontSize: "22px" }}>
                Available Grocery Items
              </h2>

              <div
                style={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: theme.panelBg,
                  zIndex: 10,
                  paddingBottom: "10px",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {sections.map((section) => (
                    <button
                      key={section}
                      onClick={() => setSelectedSection(section)}
                      style={{
                        ...compactButtonStyle,
                        borderRadius: "999px",
                        backgroundColor:
                          selectedSection === section ? theme.blueDark : "#e7ded0",
                        color: selectedSection === section ? theme.white : theme.text,
                      }}
                    >
                      {section}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Search groceries..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    marginBottom: "8px",
                    borderRadius: "12px",
                    border: `1px solid ${theme.border}`,
                    fontSize: "14px",
                    boxSizing: "border-box",
                    color: theme.text,
                    backgroundColor: theme.white,
                  }}
                />

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    onClick={clearSearchAndFilters}
                    style={{
                      ...compactButtonStyle,
                      backgroundColor: theme.tan,
                      color: theme.white,
                    }}
                  >
                    Clear Search
                  </button>
                </div>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {filteredGroceries.map((item) => {
                  const existingItem = selectedItems.find(
                    (selected) => selected.name === item.name
                  );

                  return (
                    <li
                      key={item.name}
                      onClick={() => addItem(item)}
                      style={{
                        marginBottom: "10px",
                        padding: "12px",
                        backgroundColor: existingItem ? "#edf2f0" : theme.white,
                        borderRadius: "14px",
                        border: existingItem
                          ? `2px solid ${theme.green}`
                          : `1px solid ${theme.border}`,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "6px",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <strong style={{ color: theme.text }}>{item.name}</strong>
                          <span style={{ color: theme.mutedText, marginLeft: "6px", fontSize: "13px" }}>
                            {getItemSection(item)}
                          </span>
                        </div>

                        {existingItem && (
                          <div
                            style={{
                              backgroundColor: theme.blueDark,
                              color: theme.white,
                              borderRadius: "999px",
                              padding: "3px 9px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {existingItem.quantity}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: existingItem ? theme.greenDark : theme.mutedText,
                          marginBottom: "8px",
                          fontWeight: existingItem ? 700 : 500,
                        }}
                      >
                        {existingItem ? "Already on list" : "Tap anywhere to add"}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginTop: "8px",
                        }}
                      >
                        {existingItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeEntireItem(item.name);
                            }}
                            style={{
                              ...compactButtonStyle,
                              backgroundColor: theme.warmDark,
                              color: theme.white,
                            }}
                          >
                            Remove
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addItem(item);
                          }}
                          style={{
                            ...compactButtonStyle,
                            backgroundColor: existingItem ? theme.green : theme.blue,
                            color: theme.white,
                          }}
                        >
                          {existingItem ? `Added (${existingItem.quantity})` : "Add"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(item.name);
                          }}
                          style={{
                            ...compactButtonStyle,
                            backgroundColor: favoriteItems.includes(item.name)
                              ? theme.gold
                              : "#e7ded0",
                            color: theme.warmDark,
                          }}
                        >
                          {favoriteItems.includes(item.name) ? "★ Favorite" : "☆ Favorite"}
                        </button>

                        {existingItem && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                decreaseQuantity(item.name);
                              }}
                              style={{
                                ...compactButtonStyle,
                                padding: "7px 10px",
                                backgroundColor: theme.danger,
                                color: theme.white,
                              }}
                            >
                              -
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                increaseQuantity(item.name);
                              }}
                              style={{
                                ...compactButtonStyle,
                                padding: "7px 10px",
                                backgroundColor: theme.blueDark,
                                color: theme.white,
                              }}
                            >
                              +
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {appMode === "shop" && (
            <div
              style={{
                backgroundColor: theme.panelBg,
                padding: "16px",
                borderRadius: "14px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
              }}
            >
              <h2 style={{ margin: "0 0 8px", color: theme.warmDark, fontSize: "22px" }}>
                Shopping List by Section
              </h2>
              <p style={{ marginTop: 0, marginBottom: "12px", color: theme.mutedText, fontSize: "13px" }}>
                Current store: {selectedStore}
              </p>

              <div
                style={{
                  backgroundColor: theme.white,
                  padding: "14px",
                  borderRadius: "14px",
                  border: `1px solid ${theme.border}`,
                  marginBottom: "16px",
                }}
              >
                <h2 style={{ margin: "0 0 10px", color: theme.warmDark, fontSize: "20px" }}>
                  Current Section
                </h2>

                {nextStopSection ? (
                  <>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: 800,
                        color: theme.blueDark,
                        marginBottom: "12px",
                      }}
                    >
                      {nextStopSection}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {currentSectionItems.map((item) => (
                        <div
                          key={item.name}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "10px",
                            flexWrap: "wrap",
                            backgroundColor: item.inCart
                              ? theme.greenLight
                              : theme.panelBg,
                            border: `1px solid ${theme.border}`,
                            borderRadius: "10px",
                            padding: "10px",
                          }}
                        >
                          <div
                            style={{
                              color: theme.text,
                              fontWeight: 600,
                              textDecoration: item.inCart ? "line-through" : "none",
                              opacity: item.inCart ? 0.6 : 1,
                            }}
                          >
                            {item.name} × {item.quantity}
                          </div>

                          <button
                            onClick={() => toggleInCart(item.name)}
                            style={{
                              ...compactButtonStyle,
                              backgroundColor: item.inCart
                                ? theme.tan
                                : theme.greenDark,
                              color: theme.white,
                            }}
                          >
                            {item.inCart ? "Undo" : "In Cart"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ color: theme.mutedText }}>No active section.</div>
                )}
              </div>

              {visibleSelectedItems.length === 0 ? (
                <p style={{ color: theme.mutedText }}>No items to show.</p>
              ) : (
                Object.keys(groupedItems)
                  .sort((a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b))
                  .map((section) => (
                    <div key={section} style={{ marginBottom: "18px" }}>
                      <h3
                        style={{
                          marginBottom: "10px",
                          color: theme.blueDark,
                        }}
                      >
                        {section}
                      </h3>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {groupedItems[section].map((item) => (
                          <li
                            key={item.name}
                            style={{
                              marginBottom: "10px",
                              padding: "12px",
                              backgroundColor: item.inCart
                                ? theme.greenLight
                                : theme.white,
                              borderRadius: "12px",
                              border: `1px solid ${theme.border}`,
                            }}
                          >
                            <div
                              style={{
                                marginBottom: "8px",
                                textDecoration: item.inCart ? "line-through" : "none",
                                opacity: item.inCart ? 0.6 : 1,
                                color: theme.text,
                                fontWeight: 600,
                              }}
                            >
                              {item.name} × {item.quantity}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                onClick={() => decreaseQuantity(item.name)}
                                style={{
                                  ...compactButtonStyle,
                                  padding: "7px 10px",
                                  backgroundColor: theme.danger,
                                  color: theme.white,
                                }}
                              >
                                -
                              </button>
                              <button
                                onClick={() => increaseQuantity(item.name)}
                                style={{
                                  ...compactButtonStyle,
                                  padding: "7px 10px",
                                  backgroundColor: theme.blueDark,
                                  color: theme.white,
                                }}
                              >
                                +
                              </button>
                              <button
                                onClick={() => toggleInCart(item.name)}
                                style={{
                                  ...compactButtonStyle,
                                  backgroundColor: item.inCart
                                    ? theme.tan
                                    : theme.greenDark,
                                  color: theme.white,
                                }}
                              >
                                {item.inCart ? "Undo" : "In Cart"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              )}

              <div style={{ marginTop: "24px" }}>
                <h2 style={{ marginBottom: "14px", color: theme.warmDark, fontSize: "22px" }}>
                  Store Walk Layout
                </h2>

                {remainingWalkSections.length === 0 ? (
                  <p style={{ color: theme.mutedText }}>No store route yet.</p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {remainingWalkSections.map((section, sectionIndex) => (
                      <div key={section}>
                        <div
                          style={{
                            backgroundColor: theme.blueLight,
                            border: `1px solid ${theme.border}`,
                            borderRadius: "14px",
                            padding: "12px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: "17px",
                              marginBottom: "10px",
                              color: theme.blueDark,
                            }}
                          >
                            Stop {sectionIndex + 1}: {section}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {groupedItems[section].map((item) => (
                              <div
                                key={item.name}
                                style={{
                                  backgroundColor: item.inCart
                                    ? theme.greenLight
                                    : theme.white,
                                  borderRadius: "10px",
                                  padding: "10px",
                                  border: `1px solid ${theme.border}`,
                                  textDecoration: item.inCart ? "line-through" : "none",
                                  opacity: item.inCart ? 0.6 : 1,
                                  color: theme.text,
                                  fontWeight: 600,
                                }}
                              >
                                {item.name} × {item.quantity}
                              </div>
                            ))}
                          </div>
                        </div>

                        {sectionIndex < remainingWalkSections.length - 1 && (
                          <div
                            style={{
                              textAlign: "center",
                              fontSize: "22px",
                              color: theme.mutedText,
                              margin: "6px 0",
                            }}
                          >
                            ↓
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: "24px" }}>
                <h2 style={{ marginBottom: "14px", color: theme.warmDark, fontSize: "22px" }}>
                  Store Map View
                </h2>

                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "520px",
                    backgroundColor: "#f3ede2",
                    border: `1px solid ${theme.border}`,
                    borderRadius: "18px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "35%",
                      top: "92%",
                      width: "30%",
                      textAlign: "center",
                      backgroundColor: theme.warmDark,
                      color: theme.white,
                      padding: "8px",
                      borderRadius: "12px",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}
                  >
                    Entrance / Checkout
                  </div>

                  {currentMapLayout.map((zone) => {
                    const itemsInZone = groupedItems[zone.section] || [];
                    const remainingItemsInZone = itemsInZone.filter(
                      (item) => item.inCart === false
                    );
                    const completedItemsInZone = itemsInZone.filter(
                      (item) => item.inCart === true
                    );
                    const allItemsCompleted =
                      itemsInZone.length > 0 && remainingItemsInZone.length === 0;

                    return (
                      <div
                        key={zone.section}
                        style={{
                          position: "absolute",
                          left: zone.x,
                          top: zone.y,
                          width: zone.width,
                          height: zone.height,
                          backgroundColor:
                            remainingItemsInZone.length > 0
                              ? "#dde6e6"
                              : allItemsCompleted
                              ? theme.greenLight
                              : theme.white,
                          border:
                            remainingItemsInZone.length > 0
                              ? `2px solid ${theme.blue}`
                              : allItemsCompleted
                              ? `1px solid ${theme.green}`
                              : `1px solid ${theme.border}`,
                          borderRadius: "14px",
                          padding: "10px",
                          boxSizing: "border-box",
                          overflow: "hidden",
                          opacity: allItemsCompleted ? 0.72 : 1,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "13px",
                            marginBottom: "6px",
                            color:
                              remainingItemsInZone.length > 0
                                ? theme.blueDark
                                : theme.warmDark,
                          }}
                        >
                          {zone.section}
                        </div>

                        <div
                          style={{
                            fontSize: "10px",
                            color: theme.mutedText,
                            marginBottom: "6px",
                          }}
                        >
                          {remainingItemsInZone.length} left
                          {completedItemsInZone.length > 0
                            ? ` • ${completedItemsInZone.length} done`
                            : ""}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            fontSize: "11px",
                          }}
                        >
                          {remainingItemsInZone.slice(0, 4).map((item) => (
                            <div
                              key={item.name}
                              style={{
                                backgroundColor: theme.white,
                                borderRadius: "8px",
                                padding: "4px 6px",
                                color: theme.text,
                              }}
                            >
                              {item.name} × {item.quantity}
                            </div>
                          ))}

                          {remainingItemsInZone.length > 4 && (
                            <div style={{ color: theme.mutedText }}>
                              + {remainingItemsInZone.length - 4} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}