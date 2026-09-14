"use client";

import { useEffect, useRef, useState } from "react";

export type AddressSuggestion = {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

type AddressAutocompleteProps = {
  configured: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (location: AddressSuggestion) => void;
  placeholder?: string;
};

export function AddressAutocomplete({
  configured,
  value,
  onValueChange,
  onSelect,
  placeholder = "Digite a rua e o número",
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    const query = value.normalize("NFKC").trim();
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (!configured || query.length < 3) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json() as {
          locations?: AddressSuggestion[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Não foi possível buscar o endereço.");
        setSuggestions(data.locations ?? []);
        setActiveIndex(-1);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setError(searchError instanceof Error ? searchError.message : "Não foi possível buscar o endereço.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [configured, value]);

  const choose = (location: AddressSuggestion) => {
    setSuggestions([]);
    setError("");
    setActiveIndex(-1);
    if (location.street !== value) skipNextSearch.current = true;
    onSelect(location);
  };

  return (
    <div className="address-autocomplete">
      <div className="address-autocomplete-input">
        <input
          className="form-control"
          type="search"
          role="combobox"
          aria-label="Rua"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls="street-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `street-suggestion-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onValueChange(nextValue);
            if (nextValue.trim().length < 3) {
              setSuggestions([]);
              setSearching(false);
              setError("");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && suggestions.length > 0) {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
            } else if (event.key === "ArrowUp" && suggestions.length > 0) {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && suggestions.length > 0) {
              event.preventDefault();
              choose(suggestions[activeIndex >= 0 ? activeIndex : 0]);
            } else if (event.key === "Escape") {
              setSuggestions([]);
              setActiveIndex(-1);
            }
          }}
        />
        <i className={`fas ${searching ? "fa-spinner fa-spin" : "fa-search"}`} aria-hidden="true" />
      </div>
      {suggestions.length > 0 && (
        <div className="address-autocomplete-suggestions" id="street-suggestions" role="listbox">
          {suggestions.map((location, index) => (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              id={`street-suggestion-${index}`}
              key={`${location.latitude}-${location.longitude}-${index}`}
              className={activeIndex === index ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(location)}
            >
              <i className="fas fa-map-marker-alt" />
              <span>{location.formattedAddress}</span>
            </button>
          ))}
        </div>
      )}
      {!configured && (
        <small className="address-autocomplete-help">Preenchimento automático temporariamente indisponível.</small>
      )}
      {error && <small className="address-autocomplete-error" role="status">{error}</small>}
    </div>
  );
}
