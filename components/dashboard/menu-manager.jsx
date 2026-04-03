"use client";

import { useState } from "react";

function formatCurrency(value) {
  return `GHS ${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

const emptyItem = { name: "", currentPrice: "" };

export default function MenuManager({ menuItems, onUpdate }) {
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const activeItems = menuItems.filter((item) => !item.archived);
  const archivedItems = menuItems.filter((item) => item.archived);

  function openAdd() {
    setEditingId(null);
    setDraft({ ...emptyItem });
  }

  function openEdit(item) {
    setEditingId(item.id);
    setDraft({ name: item.name, currentPrice: String(item.currentPrice) });
  }

  function closeDraft() {
    setDraft(null);
    setEditingId(null);
  }

  function handleSave() {
    const name = (draft.name || "").trim();
    const price = Number.parseFloat(draft.currentPrice);

    if (!name || !Number.isFinite(price) || price <= 0) return;

    if (editingId) {
      onUpdate(
        menuItems.map((item) =>
          item.id === editingId ? { ...item, name, currentPrice: price } : item
        )
      );
    } else {
      const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
      onUpdate([...menuItems, { id, name, currentPrice: price, archived: false }]);
    }

    closeDraft();
  }

  function handleArchive(id) {
    onUpdate(menuItems.map((item) => (item.id === id ? { ...item, archived: true } : item)));
  }

  function handleRestore(id) {
    onUpdate(menuItems.map((item) => (item.id === id ? { ...item, archived: false } : item)));
  }

  function handleRemove(id) {
    onUpdate(menuItems.filter((item) => item.id !== id));
  }

  return (
    <section className="tracker-menu-manager">
      <div className="tracker-section-intro">
        <div>
          <h2>Menu Items</h2>
          <p>Manage your menu. Changes sync across devices.</p>
        </div>
      </div>

      <div className="tracker-log-card">
        <div className="tracker-section-head">
          <div>
            <h3>Active items</h3>
            <p>These items appear in the sales form.</p>
          </div>
          <span>{activeItems.length}</span>
        </div>

        {activeItems.length ? (
          <div className="tracker-log-list">
            {activeItems.map((item) => (
              <article className="tracker-log-row" key={item.id}>
                <div className="tracker-log-main tracker-log-main--tappable" role="button" tabIndex={0} onClick={() => openEdit(item)} onKeyDown={(e) => e.key === "Enter" && openEdit(item)}>
                  <strong>{item.name}</strong>
                  <small>{formatCurrency(item.currentPrice)}</small>
                </div>
                <div className="tracker-log-side">
                  <div className="tracker-log-actions">
                    <button
                      className="tracker-icon-button tracker-icon-button--small tracker-icon-button--edit"
                      type="button"
                      aria-label="Edit item"
                      onClick={() => openEdit(item)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M15.232 5.232l3.536 3.536M9 13l-2 6 6-2 9.373-9.373a2.5 2.5 0 00-3.536-3.536L9 13z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      className="tracker-icon-button tracker-icon-button--small"
                      type="button"
                      aria-label="Archive item"
                      onClick={() => handleArchive(item.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 6H21M5 6V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V6M9 10L12 13L15 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tracker-empty">
            <strong>No active items</strong>
            <p>Add a menu item to get started.</p>
          </div>
        )}

        <button className="tracker-utility-button tracker-utility-button--primary tracker-menu-add" type="button" onClick={openAdd}>
          + Add item
        </button>
      </div>

      {archivedItems.length ? (
        <div className="tracker-log-card">
          <div className="tracker-section-head">
            <div>
              <h3>Archived</h3>
              <p>Hidden from the sales form. Can be restored.</p>
            </div>
            <span>{archivedItems.length}</span>
          </div>
          <div className="tracker-log-list">
            {archivedItems.map((item) => (
              <article className="tracker-log-row tracker-log-row--archived" key={item.id}>
                <div className="tracker-log-main">
                  <strong>{item.name}</strong>
                  <small>{formatCurrency(item.currentPrice)}</small>
                </div>
                <div className="tracker-log-side">
                  <div className="tracker-log-actions">
                    <button className="tracker-inline-button" type="button" onClick={() => handleRestore(item.id)}>
                      Restore
                    </button>
                    <button className="tracker-inline-button tracker-inline-button--danger" type="button" onClick={() => handleRemove(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="tracker-modal-backdrop" role="presentation" onClick={closeDraft}>
          <div className="tracker-modal tracker-composer-modal" role="dialog" aria-modal="true" aria-label={editingId ? "Edit menu item" : "Add menu item"} onClick={(e) => e.stopPropagation()}>
            <div className="tracker-modal-header">
              <div>
                <h2>{editingId ? "Edit item" : "New item"}</h2>
                <p>Set the name and current price.</p>
              </div>
              <button className="tracker-modal-close" type="button" onClick={closeDraft} aria-label="Close dialog">
                Close
              </button>
            </div>

            <div className="tracker-entry-form tracker-entry-form--modal">
              <label className="tracker-field">
                <span>Item name</span>
                <input
                  type="text"
                  placeholder="Jollof Rice + Chicken"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="tracker-field">
                <span>Price (GHS)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="40"
                  value={draft.currentPrice}
                  onChange={(e) => setDraft((d) => ({ ...d, currentPrice: e.target.value }))}
                />
              </label>
              <button className="tracker-primary-button tracker-primary-button--full" type="button" onClick={handleSave}>
                {editingId ? "Update item" : "Add item"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
