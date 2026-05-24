import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Updates from "expo-updates";

type EasUpdateState = {
  updateAvailable: boolean;
  restarting: boolean;
  dismissUpdate: () => void;
  applyUpdate: () => Promise<void>;
};

export function useEasUpdate(): EasUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkForUpdate = async () => {
      if (Platform.OS === "android") {
        return;
      }

      if (__DEV__) {
        console.log("Updates: skipping EAS update check in development.");
        return;
      }

      if (!Updates.isEnabled) {
        return;
      }

      try {
        const result = await Updates.checkForUpdateAsync();

        if (mounted && result.isAvailable) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.log("Updates: check failed", error);
      }
    };

    void checkForUpdate();

    return () => {
      mounted = false;
    };
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  const applyUpdate = useCallback(async () => {
    if (Platform.OS === "android") {
      setUpdateAvailable(false);
      return;
    }

    if (__DEV__) {
      console.log("Updates: skipping EAS update fetch in development.");
      setUpdateAvailable(false);
      return;
    }

    if (!Updates.isEnabled) {
      setUpdateAvailable(false);
      return;
    }

    setRestarting(true);

    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (error) {
      console.log("Updates: update failed", error);
      setRestarting(false);
      setUpdateAvailable(false);
    }
  }, []);

  return {
    updateAvailable,
    restarting,
    dismissUpdate,
    applyUpdate,
  };
}
