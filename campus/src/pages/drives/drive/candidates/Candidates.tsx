import { motion } from "framer-motion";
import { DataTable } from "./DataTable";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { Button } from "@heroui/button";
import { Pagination } from "@heroui/pagination";
import { useLocation, useNavigate } from "react-router-dom";
import { Candidate as ICandidate } from "@shared-types/Candidate";

interface Candidate extends ICandidate {
  status: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface CandidatesResponse {
  candidates: Candidate[];
  pagination: PaginationInfo;
}

const Candidates = () => {
  const [candidatesData, setCandidatesData] = useState<Candidate[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const location = useLocation();
  const navigate = useNavigate();

  // Extract search query from URL
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get("search") || "";

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const fetchCandidates = async (page: number = 1, search: string = "") => {
    setIsLoading(true);

    const driveId = window.location.pathname.split("/")[2];

    let url = `/drives/${driveId}/candidates?page=${page}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }

    try {
      const res = await axios.get(url);
      const data = res.data.data as CandidatesResponse;
      console.log("Candidates data:", data);

      setCandidatesData(data.candidates);
      setPagination(
        data.pagination || {
          total: 0,
          page: 1,
          pages: 1,
          limit: 10,
        }
      );
    } catch (error) {
      console.error("Error fetching candidates:", error);
      setCandidatesData([]);
      setPagination({
        total: 0,
        page: 1,
        pages: 1,
        limit: 10,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates(currentPage, searchQuery);
  }, [currentPage]);

  // Effect to update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentSearch = params.get("search") || "";

    if (currentSearch !== searchQuery) {
      if (searchQuery) {
        params.set("search", searchQuery);
      } else {
        params.delete("search");
      }

      navigate(
        {
          pathname: location.pathname,
          search: params.toString(),
        },
        { replace: true }
      );
    }
  }, [searchQuery, location.pathname]);

  const downloadResume = (candidateId: string) => {
    return axios
      .get(`/institutes/candidate/${candidateId}/resume`)
      .then((res) => {
        window.open(res.data.data.url);
      });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && (!pagination || newPage <= pagination.pages)) {
      setCurrentPage(newPage);
    }
  };

  const handleSearch = (query: string) => {
    // Only fetch if the page is 1 or the query changes
    if (currentPage === 1) {
      fetchCandidates(1, query);
    } else {
      // Reset to page 1 when searching
      setCurrentPage(1);
    }
  };

  const refreshData = () => {
    fetchCandidates(currentPage, searchQuery);
  };

  return (
    <div className="w-full p-7">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between items-cente mb-3">
          <h4>Candidates</h4>
          <div className="flex items-center gap-4">
            <Button onClick={refreshData} size="sm">
              Refresh
            </Button>
          </div>
        </div>

        <DataTable
          data={candidatesData}
          downloadResume={downloadResume}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          isLoading={isLoading}
        />

        {pagination && (
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {pagination.total > 0 ? (
                  <>
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}{" "}
                    of {pagination.total} records
                  </>
                ) : (
                  <>No records found</>
                )}
              </div>

              <div className="flex justify-center">
                {pagination.total > 0 && (
                  <Pagination
                    total={pagination.pages || 1}
                    initialPage={pagination.page}
                    onChange={handlePageChange}
                    showControls
                    color="primary"
                    isDisabled={pagination.total === 0}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Candidates;
