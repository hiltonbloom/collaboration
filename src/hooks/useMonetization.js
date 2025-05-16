// src/hooks/useMonetization.js
import { useState, useEffect, useContext, createContext } from 'react';

const MonetizationContext = createContext(null);

export const MonetizationProvider = ({ children }) => {
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [usageMetrics, setUsageMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch subscription data on component mount
  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        // These API endpoints would connect to your future FastAPI service
        const subscriptionResponse = await fetch('/api/subscriptions/current');
        const plansResponse = await fetch('/api/subscriptions/plans');
        const usageResponse = await fetch('/api/subscriptions/usage');
        
        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json();
          setCurrentSubscription(subscriptionData);
        }
        
        if (plansResponse.ok) {
          const plansData = await plansResponse.json();
          setSubscriptionPlans(plansData);
        }
        
        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          setUsageMetrics(usageData);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionData();
  }, []);

  // Subscribe to a plan
  const subscribeToPlan = async (planId, paymentMethodId) => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId, paymentMethodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe to plan');
      }

      const subscription = await response.json();
      setCurrentSubscription(subscription);
      return subscription;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Cancel subscription
  const cancelSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const result = await response.json();
      setCurrentSubscription(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update payment method
  const updatePaymentMethod = async (paymentMethodId) => {
    try {
      setLoading(true);
      const response = await fetch('/api/payment-methods', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment method');
      }

      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get invoices
  const getInvoices = async () => {
    try {
      const response = await fetch('/api/invoices');
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <MonetizationContext.Provider
      value={{
        currentSubscription,
        subscriptionPlans,
        usageMetrics,
        loading,
        error,
        subscribeToPlan,
        cancelSubscription,
        updatePaymentMethod,
        getInvoices,
      }}
    >
      {children}
    </MonetizationContext.Provider>
  );
};

export const useMonetization = () => {
  const context = useContext(MonetizationContext);
  if (!context) {
    throw new Error('useMonetization must be used within a MonetizationProvider');
  }
  return context;
};