/**
 * Path: apps/mobile/components/LocationSearch.tsx
 * Description: Google Places autocomplete search used to attach a venue/location to a plan.
 * Always shows the search input directly.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const DEFAULT_LOCATION = "52.3676,4.9041"; // Amsterdam center

export default function LocationSearch({ value, onChange }: Props) {
  return (
    <View style={styles.wrapper}>
      

      <GooglePlacesAutocomplete
        placeholder="Search for a bar or venue..."
        textInputProps={{
          placeholderTextColor: "#64748b",
        }}
        onPress={(data) => {
          onChange(data.description);
        }}
        query={{
          key: GOOGLE_MAPS_KEY,
          language: "en",
          location: DEFAULT_LOCATION,
          radius: "100000",
        }}
        debounce={350}
        enablePoweredByContainer={false}
        disableScroll={true}
        keyboardShouldPersistTaps="handled"
        fetchDetails={false}
        styles={{
          container: styles.container,
          textInput: styles.input,
          listView: styles.listView,
          row: styles.row,
          description: styles.description,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 2000,
  },
  container: {
    flex: 0,
  },
  
  input: {
    height: 58,
    fontSize: 18,
    lineHeight: 22,
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#bae6fd",
    color: "#003049",
  },  listView: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
    maxHeight: 220,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  description: {
    color: "#003049",
    fontSize: 16,
  },
});