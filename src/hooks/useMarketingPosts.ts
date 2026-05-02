import { useState, useEffect } from 'react';
import { ref, onValue, off, query, orderByChild, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { Employee } from '@/types/employee';
import { MarketingPost } from '@/types/popup';
import { User } from '@/types/user';

export const useMarketingPosts = (user: User | unknown, employees: Employee[]) => {
  const [marketingPosts, setMarketingPosts] = useState<MarketingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || employees.length === 0) {
      setLoading(false);
      return;
    }

    // Only employees in Digital Marketing department
    const digitalMarketingEmployees = employees.filter(emp => emp.department === 'Digital Marketing');
    const allPosts: MarketingPost[] = [];
    const unsubscribes: (() => void)[] = [];

    const dmEmployeesByAdmin = digitalMarketingEmployees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(dmEmployeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const postsRef = ref(database, `users/${adminId}/employees/${employee.id}/socialmedia`);
        const postsQuery = query(postsRef, orderByChild('createdAt'));

        const unsubscribe = onValue(postsQuery, (snapshot: DataSnapshot) => {
          const data = snapshot.val() as Record<string, Omit<MarketingPost, 'id' | 'adminId'>> | null;

          // Remove existing posts by this employee
          const index = allPosts.findIndex(p => p.createdBy === employee.id);
          if (index !== -1) allPosts.splice(index, 1);

          if (data && typeof data === 'object') {
            const posts: MarketingPost[] = Object.entries(data).map(([key, value]) => ({
              id: key,
              adminId: adminId,
              platform: value.platform,
              content: value.content,
              scheduledDate: value.scheduledDate,
              scheduledTime: value.scheduledTime,
              postUrl: value.postUrl,
              imageUrl: value.imageUrl,
              status: value.status,
              createdBy: value.createdBy,
              createdByName: value.createdByName,
              department: value.department,
              createdAt: value.createdAt,
              updatedAt: value.updatedAt
            }));
            allPosts.push(...posts);
          }

          setMarketingPosts([...allPosts].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
          setLoading(false);
        });

        unsubscribes.push(unsubscribe);
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, employees]);

  return { marketingPosts, loading };
};