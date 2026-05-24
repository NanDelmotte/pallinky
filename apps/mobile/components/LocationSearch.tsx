/**
 * Path: apps/mobile/components/LocationSearch.tsx
 * Description: Google Places search used to attach a venue/location to a plan.
 * Always shows the search input directly.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useI18n } from "@pallinky/i18n/client";

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const DEFAULT_COORDS = { latitude: 52.3676, longitude: 4.9041 }; // Amsterdam center
const SEARCH_RADIUS_METERS = 100000;
const MIN_QUERY_LENGTH = 3;

type Props = {
  value: string;
  onChange: (value: string) => void;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type PlacePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type AutocompleteResponse = {
  predictions?: PlacePrediction[];
  status?: string;
  error_message?: string;
};

type PlaceDetailsResponse = {
  result?: {
    formatted_address?: string;
    name?: string;
  };
  status?: string;
  error_message?: string;
};

type SearchStatus = "idle" | "missing-key" | "search-error" | "no-results";

export default function LocationSearch({ value, onChange }: Props) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [coords, setCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const requestIdRef = useRef(0);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!isMounted) {
        return;
      }

      setCoords({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
    }

    loadCurrentLocation().catch(() => {
      // Search still works with the default city bias if location access fails.
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const searchUrl = useMemo(
    () =>
      buildGooglePlacesUrl("autocomplete", {
        key: GOOGLE_MAPS_KEY,
        language: "en",
        input: inputValue.trim(),
        location: `${coords.latitude},${coords.longitude}`,
        radius: String(SEARCH_RADIUS_METERS),
        strictbounds: "false",
      }),
    [coords.latitude, coords.longitude, inputValue]
  );

  useEffect(() => {
    const trimmedInput = inputValue.trim();

    if (!searchUrl || trimmedInput.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setIsSearching(false);
      setSearchStatus(!GOOGLE_MAPS_KEY && trimmedInput.length >= MIN_QUERY_LENGTH ? "missing-key" : "idle");
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setIsSearching(true);
    setSearchStatus("idle");

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(searchUrl);
        const json = (await response.json()) as AutocompleteResponse;

        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        const nextPredictions = json.status === "OK" ? json.predictions ?? [] : [];
        setPredictions(nextPredictions);
        setSearchStatus(nextPredictions.length > 0 ? "idle" : json.status === "ZERO_RESULTS" ? "no-results" : "search-error");
      } catch {
        if (requestIdRef.current === currentRequestId) {
          setPredictions([]);
          setSearchStatus("search-error");
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputValue, searchUrl]);

  const handleTextChange = useCallback(
    (nextValue: string) => {
      setInputValue(nextValue);
      setSearchStatus("idle");
      onChange(nextValue);
    },
    [onChange]
  );

  const resolvePlace = useCallback(
    async (prediction: PlacePrediction) => {
      const fallbackLocation = prediction.description;
      setInputValue(fallbackLocation);
      setPredictions([]);
      onChange(fallbackLocation);

      if (!GOOGLE_MAPS_KEY) {
        return;
      }

      setIsResolvingPlace(true);

      try {
        const url = buildGooglePlacesUrl("details", {
          key: GOOGLE_MAPS_KEY,
          place_id: prediction.place_id,
          fields: "formatted_address,name",
          language: "en",
        });

        const response = await fetch(url);
        const json = (await response.json()) as PlaceDetailsResponse;
        const exactLocation =
          json.result?.formatted_address || json.result?.name || fallbackLocation;

        setInputValue(exactLocation);
        onChange(exactLocation);
      } catch {
        setInputValue(fallbackLocation);
        onChange(fallbackLocation);
      } finally {
        setIsResolvingPlace(false);
      }
    },
    [onChange]
  );

  const showResults = isFocused && predictions.length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputWrap}>
        <TextInput
          value={inputValue}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          placeholder={t("location_search_placeholder")}
          placeholderTextColor="#64748b"
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
        />
        {(isSearching || isResolvingPlace) && (
          <ActivityIndicator color="#0ea5e9" size="small" style={styles.spinner} />
        )}
      </View>

      {showResults && (
        <View style={styles.listView}>
          {predictions.map((prediction) => (
            <Pressable
              key={prediction.place_id}
              onPress={() => {
                setIsFocused(false);
                resolvePlace(prediction);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.primaryText} numberOfLines={1}>
                {prediction.structured_formatting?.main_text || prediction.description}
              </Text>
              {!!prediction.structured_formatting?.secondary_text && (
                <Text style={styles.secondaryText} numberOfLines={1}>
                  {prediction.structured_formatting.secondary_text}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {isFocused && searchStatus !== "idle" && (
        <Text style={styles.statusText}>
          {searchStatus === "no-results"
            ? "No places found nearby."
            : "Place search is unavailable right now."}
        </Text>
      )}
    </View>
  );
}

function buildGooglePlacesUrl(
  endpoint: "autocomplete" | "details",
  params: Record<string, string | undefined>
) {
  const query = Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value ?? "")}`)
    .join("&");

  return `https://maps.googleapis.com/maps/api/place/${endpoint}/json?${query}`;
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 2000,
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    height: 58,
    fontSize: 18,
    lineHeight: 22,
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingTop: 16,
    paddingBottom: 12,
    paddingLeft: 15,
    paddingRight: 44,
    borderWidth: 1,
    borderColor: "#bae6fd",
    color: "#003049",
  },
  spinner: {
    position: "absolute",
    right: 14,
    top: 19,
  },
  listView: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
    maxHeight: 260,
    overflow: "hidden",
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dbeafe",
  },
  rowPressed: {
    backgroundColor: "#f0f9ff",
  },
  primaryText: {
    color: "#003049",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  statusText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 2,
  },
});
