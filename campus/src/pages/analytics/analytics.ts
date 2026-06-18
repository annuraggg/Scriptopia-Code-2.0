  import {
    AnalyticsData,
    DashboardStats,
    DepartmentStats,
    OfferLetterStats,
    TimeRangeStats,
  } from "@shared-types/InstituteAnalytics";
  import { useAuth } from "@/auth";
  import ax from "@/config/axios";

  export const useAnalyticsService = () => {
    const { getToken } = useAuth();
    const axios = ax(getToken);

    const fetchAnalytics = async (): Promise<AnalyticsData> => {
      const response = await axios.get("/institutes/analytics");
      return response.data.data;
    };

    const fetchDashboardStats = async (): Promise<DashboardStats> => {
      const response = await axios.get("/institutes/analytics/dashboard");
      return response.data.data;
    };

    const fetchDepartmentAnalytics = async (): Promise<DepartmentStats> => {
      const response = await axios.get("/institutes/analytics/departments");
      return response.data.data;
    };

    const fetchOfferLetterAnalytics = async (): Promise<OfferLetterStats> => {
      const response = await axios.get("/institutes/analytics/offerletters");
      return response.data.data;
    };

    const fetchTimeRangeAnalytics = async (
      startDate: string,
      endDate: string
    ): Promise<TimeRangeStats> => {
      const response = await axios.get(
        `/institutes/analytics/timerange?startDate=${startDate}&endDate=${endDate}`
      );
      return response.data.data;
    };

    return {
      fetchAnalytics,
      fetchDashboardStats,
      fetchDepartmentAnalytics,
      fetchOfferLetterAnalytics,
      fetchTimeRangeAnalytics,
    };
  };

  export const fetchAnalytics = async (): Promise<AnalyticsData> => {
    const analyticsService = useAnalyticsService();
    return analyticsService.fetchAnalytics();
  };

  export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    const analyticsService = useAnalyticsService();
    return analyticsService.fetchDashboardStats();
  };

  export const fetchDepartmentAnalytics = async (): Promise<DepartmentStats> => {
    const analyticsService = useAnalyticsService();
    return analyticsService.fetchDepartmentAnalytics();
  };

  export const fetchOfferLetterAnalytics = async (): Promise<OfferLetterStats> => {
    const analyticsService = useAnalyticsService();
    return analyticsService.fetchOfferLetterAnalytics();
  };

  export const fetchTimeRangeAnalytics = async (
    startDate: string,
    endDate: string
  ): Promise<TimeRangeStats> => {
    const analyticsService = useAnalyticsService();
    return analyticsService.fetchTimeRangeAnalytics(startDate, endDate);
  };