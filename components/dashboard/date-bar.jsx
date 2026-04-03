"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createRangeDateFilter,
  createSingleDateFilter,
  createTodayFilter,
  createYesterdayFilter,
  getDateBounds,
  normalizeDate,
} from "@/lib/dashboard";

const singleDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const rangeDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function isSameSingleDate(filter, value) {
  return filter.type === "single" && normalizeDate(filter.value) === normalizeDate(value);
}

export default function DateBar({
  dateFilter,
  onApplyFilter,
  onPrevious,
  onNext,
  onToday,
  onYesterday,
}) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [draftType, setDraftType] = useState(dateFilter.type);
  const [draftSingle, setDraftSingle] = useState(dateFilter.value || normalizeDate(new Date()));
  const [draftFrom, setDraftFrom] = useState(dateFilter.from || normalizeDate(new Date()));
  const [draftTo, setDraftTo] = useState(dateFilter.to || normalizeDate(new Date()));

  const label = useMemo(() => {
    const { from, to } = getDateBounds(dateFilter);

    if (dateFilter.type === "range" && from !== to) {
      return `${rangeDateFormatter.format(new Date(from))} - ${rangeDateFormatter.format(new Date(to))}`;
    }

    return singleDateFormatter.format(new Date(from));
  }, [dateFilter]);

  useEffect(() => {
    const { from, to } = getDateBounds(dateFilter);
    setDraftType(dateFilter.type);
    setDraftSingle(dateFilter.value || from);
    setDraftFrom(from);
    setDraftTo(to);
  }, [dateFilter]);

  function handleApply() {
    if (draftType === "range") {
      onApplyFilter(createRangeDateFilter(draftFrom, draftTo));
    } else {
      onApplyFilter(createSingleDateFilter(draftSingle));
    }

    setIsCustomOpen(false);
  }

  return (
    <>
      <div className="tracker-datebar">
        <button className="tracker-datebar-arrow" type="button" onClick={onPrevious} aria-label="Previous date">
          <span aria-hidden="true">{"<"}</span>
        </button>
        <button className="tracker-datebar-label" type="button" onClick={() => setIsCustomOpen(true)}>
          {label}
        </button>
        <button className="tracker-datebar-arrow" type="button" onClick={onNext} aria-label="Next date">
          <span aria-hidden="true">{">"}</span>
        </button>
        <button
          className={`tracker-datebar-chip ${isSameSingleDate(dateFilter, createTodayFilter().value) ? "is-active" : ""}`}
          type="button"
          onClick={onToday}
        >
          Today
        </button>
        <button
          className={`tracker-datebar-chip ${isSameSingleDate(dateFilter, createYesterdayFilter().value) ? "is-active" : ""}`}
          type="button"
          onClick={onYesterday}
        >
          Yesterday
        </button>
        <button
          className={`tracker-datebar-chip ${dateFilter.type === "range" ? "is-active" : ""}`}
          type="button"
          onClick={() => setIsCustomOpen(true)}
        >
          Custom
        </button>
      </div>

      {isCustomOpen ? (
        <div className="tracker-modal-backdrop" role="presentation" onClick={() => setIsCustomOpen(false)}>
          <div
            className="tracker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose date filter"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tracker-modal-header">
              <div>
                <h2>Custom date</h2>
                <p>Switch between a single day and a date range.</p>
              </div>
              <button className="tracker-modal-close" type="button" onClick={() => setIsCustomOpen(false)}>
                Close
              </button>
            </div>

            <div className="tracker-segmented">
              <button
                className={`tracker-segment ${draftType === "single" ? "is-active" : ""}`}
                type="button"
                onClick={() => setDraftType("single")}
              >
                Single day
              </button>
              <button
                className={`tracker-segment ${draftType === "range" ? "is-active" : ""}`}
                type="button"
                onClick={() => setDraftType("range")}
              >
                Range
              </button>
            </div>

            {draftType === "range" ? (
              <div className="tracker-modal-fields">
                <label className="tracker-modal-field">
                  <span>From</span>
                  <input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} />
                </label>
                <label className="tracker-modal-field">
                  <span>To</span>
                  <input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
                </label>
              </div>
            ) : (
              <label className="tracker-modal-field">
                <span>Date</span>
                <input type="date" value={draftSingle} onChange={(event) => setDraftSingle(event.target.value)} />
              </label>
            )}

            <div className="tracker-modal-actions">
              <button className="tracker-secondary-button" type="button" onClick={() => setIsCustomOpen(false)}>
                Cancel
              </button>
              <button className="tracker-primary-button" type="button" onClick={handleApply}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
