import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Bell, BookOpen, MonitorPlay, Info, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function NotificationsScreen() {
  const { t, language } = useLanguage();
  const { user, token, apiBase } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${apiBase}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`${apiBase}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationPress = (notification: any) => {
    if (!notification.isRead) markAsRead(notification.id);
    
    if (notification.type === 'new_course' && notification.referenceId) {
      router.push(`/course/${notification.referenceId}`);
    } else if (notification.type === 'live_session_starting' && notification.referenceId) {
      // Assuming a route exists for live sessions or session room
      // router.push(`/live/${notification.referenceId}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_course': return <BookOpen size={24} color={Colors.light.tint} />;
      case 'live_session_starting': return <MonitorPlay size={24} color="#10b981" />;
      case 'live_session_cancelled': return <AlertTriangle size={24} color="#ef4444" />;
      default: return <Info size={24} color="#3b82f6" />;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: language === 'ar' ? 'الإشعارات' : 'Notifications',
        }} 
      />
      
      <FlatList
        data={notifications}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Bell size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {language === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
            onPress={() => handleNotificationPress(item)}
          >
            <View style={styles.iconContainer}>
              {getIcon(item.type)}
            </View>
            <View style={styles.contentContainer}>
              <Text style={[styles.title, !item.isRead && styles.unreadText]}>
                {language === 'ar' ? item.titleAr : item.title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {language === 'ar' ? item.messageAr : item.message}
              </Text>
            </View>
            {!item.isRead && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    alignItems: 'flex-start',
  },
  unreadCard: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  iconContainer: {
    marginRight: 12,
    marginLeft: 4,
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    textAlign: 'left',
  },
  unreadText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    textAlign: 'left',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.tint,
    marginLeft: 8,
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  }
});
