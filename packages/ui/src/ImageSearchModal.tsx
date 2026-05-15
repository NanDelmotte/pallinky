/**
 * Path: components/studio/ImageSearchModal.tsx
 * Description: Unsplash image search component. Allows users to find and select cover photos.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons } from '@expo/vector-icons';

interface ImageSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  initialQuery?: string;
}

const UNSPLASH_ACCESS_KEY = 'uN_q_mAiD9e2cE0DItRvZpSBTp4nmWiYv_BeEh6NcKk';

export default function ImageSearchModal({
  visible,
  onClose,
  onSelect,
  initialQuery = '',
}: ImageSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery);
  }, [visible, initialQuery]);

  const searchImages = async (searchTerm?: string) => {
    const finalQuery = (searchTerm ?? query).trim();
    if (!finalQuery) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(finalQuery)}&per_page=20&client_id=${UNSPLASH_ACCESS_KEY}`
      );
      const data = await response.json();
      setImages(data.results || []);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;

    const seededQuery = initialQuery.trim();
    if (!seededQuery) {
      setImages([]);
      return;
    }

    void searchImages(seededQuery);
  }, [visible, initialQuery]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          <StyledText style={styles.headerTitle}>Find a Cover Photo</StyledText>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Search e.g. 'Dinner Party', 'Cocktails'..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => searchImages()}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => searchImages()}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#43691b" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={images}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.imageWrapper}
                onPress={() => {
                  onSelect(item.urls.regular);
                  onClose();
                }}
              >
                <Image source={{ uri: item.urls.small }} style={styles.img} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#f0f0f0', padding: 12, borderRadius: 10, fontSize: 16 },
  searchBtn: { backgroundColor: '#43691b', padding: 12, borderRadius: 10, justifyContent: 'center' },
  list: { paddingHorizontal: 15 },
  imageWrapper: { flex: 1, aspectRatio: 1, margin: 5, borderRadius: 10, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
});