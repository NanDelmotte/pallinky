/** * Path: components/GiphyPicker.tsx 
 * Description: Giphy search modal. Fetches trending GIFs on load and supports real-time search. 
 * Updated: Integrated user Giphy API Key and refined search debounce. */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TextInput, FlatList, Image, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons } from '@expo/vector-icons';

interface GiphyPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

const GIPHY_API_KEY = 'omG5ZXggv1OfJSPIpGVJp2oVLuPgCpzi'; 

export const GiphyPicker = ({ visible, onClose, onSelect }: GiphyPickerProps) => {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGifs = async (query: string) => {
    setLoading(true);
    try {
      const endpoint = query 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;
      
      const response = await fetch(endpoint);
      const { data } = await response.json();
      setGifs(data || []);
    } catch (error) {
      console.error("Giphy Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchGifs('');
    } else {
      setSearch('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const delayDebounceFn = setTimeout(() => {
      fetchGifs(search);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="chevron-down" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput
              style={styles.input}
              placeholder="Search GIFs..."
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        </View>

        {loading && gifs.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color="#43691b" /></View>
        ) : (
          <FlatList
            data={gifs}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.gifWrapper} 
                onPress={() => onSelect(item.images.fixed_height.url)}
              >
                <Image 
                  source={{ uri: item.images.fixed_height.url }} 
                  style={styles.gif} 
                />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  searchBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f5f5f5', 
    borderRadius: 12, 
    paddingHorizontal: 12,
    height: 45
  },
  input: { flex: 1, marginLeft: 8, fontSize: 16 },
  list: { padding: 5 },
  gifWrapper: { flex: 1, margin: 5, height: 150, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' },
  gif: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});