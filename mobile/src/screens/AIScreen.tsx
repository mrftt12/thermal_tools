import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDevice } from '../context/DeviceContext';
import { useThemeColors } from '../context/ThemeContext';
import { mobileApi } from '../lib/api';
import { AIMessage } from '../types/api';

const AI_SESSION = 'default';

export function AIScreen() {
  const { deviceId } = useDevice();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!deviceId) return;

    setLoading(true);
    try {
      const payload = await mobileApi.getAIMessages(deviceId, AI_SESSION);
      setMessages(payload.messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load AI chat history';
      Alert.alert('AI Chat Error', message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      void loadMessages();
    }, [loadMessages]),
  );

  const send = async () => {
    if (!deviceId || !draft.trim() || sending) return;

    const userText = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const response = await mobileApi.sendAIMessage(deviceId, userText, AI_SESSION);
      setMessages((current) => [...current, ...response.messages]);
    } catch (error) {
      setDraft(userText);
      const message = error instanceof Error ? error.message : 'Unable to send message';
      Alert.alert('AI Chat Error', message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 88, android: 0 })}
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>AI Thermal Expert</Text>
        <Text style={styles.subTitle}>
          Ask about Neher-McGrath, transient loading, emergency ratings, and cable thermal behavior.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.message_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const assistant = item.role === 'assistant';
            return (
              <View style={[styles.messageBubble, assistant ? styles.assistantBubble : styles.userBubble]}>
                <Text style={[styles.messageRole, assistant ? styles.assistantRole : styles.userRole]}>
                  {assistant ? 'AI Expert' : 'You'}
                </Text>
                <Text style={styles.messageText}>{item.content}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Start chatting with the thermal modeling expert. Chat history is persistent on this device.
            </Text>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask a thermal modeling question..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={sending || !draft.trim()}>
          <Text style={styles.sendButtonText}>{sending ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 10,
      gap: 10,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 4,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
    },
    subTitle: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    loaderWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: 10,
      gap: 8,
    },
    messageBubble: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      gap: 5,
      maxWidth: '92%',
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.secondarySurface,
      borderColor: colors.cyanMuted,
    },
    messageRole: {
      fontSize: 11,
      fontWeight: '700',
    },
    assistantRole: {
      color: colors.cyan,
    },
    userRole: {
      color: colors.textSecondary,
    },
    messageText: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 19,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: 18,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-end',
      borderTopWidth: 1,
      borderColor: colors.border,
      paddingTop: 8,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
      maxHeight: 120,
    },
    sendButton: {
      backgroundColor: colors.cyan,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    sendButtonText: {
      color: colors.primaryTextOnCyan,
      fontWeight: '700',
    },
  });
