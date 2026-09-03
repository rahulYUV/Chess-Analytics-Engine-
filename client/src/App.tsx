/**
 * App.tsx
 * Main entry point for the Chess Stats Application Client.
 * Handles routing, main page logic, state management for user lookups,
 * and renders the primary UI layout.
 */

import { useState, useEffect, useRef } from 'react'
import { Routes, Route } from "react-router-dom"
import { motion, AnimatePresence } from "motion/react"
import { Search, ChevronDown, ChevronUp, User, Activity, Swords, Lightbulb } from "lucide-react"

// --- UI Components ---
import { Input } from "@/components/ui/input"
import { Button as MovingButton } from "@/components/ui/moving-border"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GridBackground } from "@/components/ui/grid-background"

// --- Custom Components ---
import StatsGrid from "@/components/stats-grid"
import ComparisonView from "@/components/comparison-view"
import InsightsView from "@/components/insights-view"
import ChartAreaInteractive from "@/components/chart-area-interactive"
import { FeedbackForm } from "@/components/feedback-form"
import { StatsSkeleton } from "@/components/stats-skeleton"
import { StatsReceipt } from "@/components/stats-receipt"
import { WhatWeDo } from "@/components/what-we-do"
import { WallOfFame } from "@/components/wall-of-fame"
import { HeroSection } from "@/components/hero-section"
import { IntroAnimation } from "@/components/intro-animation"
import { Shader3 } from "@/components/shader-footer"
import { TeamSection } from "@/components/team-section"
import { PlayfulTodolist } from "@/components/playful-todolist"
import { Navbar } from "@/components/Navbar"
import { AuthCallback } from "@/components/AuthCallback"
import { AuthError } from "@/components/AuthError"
import { ProfilePage } from "@/components/ProfilePage"
import AnalysisPage from "@/components/AnalysisPage"
import FloatingDockDemo from "@/components/floating-dock-demo"

// --- Types ---
import type { PlayerData, ComparisonData } from "@/types"

/**
 * Home Component
 * The landing page of the application.
 * Manages the search input, comparison mode, data fetching, and displays
 * the relevant statistical views (Profile, Stats, Compare, Insights).
 */
function Home() {
  // --- State Management ---
  const [showIntro, setShowIntro] = useState(true) // Controls the initial splash screen
  const [username, setUsername] = useState("") // Primary user search query
  const [username2, setUsername2] = useState("") // Secondary user for comparison
  const [mode, setMode] = useState("profile") // Current value of the mode selector
  const [data, setData] = useState<PlayerData | ComparisonData | null>(null) // Fetched API data
  const [error, setError] = useState("") // UI error messages
  const [loading, setLoading] = useState(false) // Loading indicator state
  const [showJson, setShowJson] = useState(false) // Toggle for raw JSON debug view
  const abortControllerRef = useRef<AbortController | null>(null) // To cancel in-flight requests

  useEffect(() => {
    if (username && mode !== 'compare') {
      fetchData();
    } else {
      setData(null);
      setError("");
    }
  }, [mode]);

  /**
   * Fetches player data from the API based on the selected mode and usernames.
   * Handles request cancellation to prevent race conditions.
   * @param usernameOverride - Optional username to fetch directly (used for direct selection)
   */
  const fetchData = async (usernameOverride?: string) => {
    setError("")
    const userToFetch = usernameOverride || username;

    if (!userToFetch.trim()) {
      setLoading(false)
      setError("Please enter a username")
      return
    }

    if (mode === 'compare' && !username2.trim()) {
      setLoading(false)
      setError("Please enter a second username for comparison")
      return
    }

    // Abort previous request only after validation succeeds.
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setData(null)

    setLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      let endpoint = '';

      switch (mode) {
        case 'stats':
          endpoint = `${apiUrl}/player/${userToFetch.trim()}/stats`;
          break;
        case 'compare':
          endpoint = `${apiUrl}/compare/${userToFetch.trim()}/${username2.trim()}`;
          break;
        case 'insights':
          endpoint = `${apiUrl}/player/${userToFetch.trim()}/insights`;
          break;
        default:
          endpoint = `${apiUrl}/player/${userToFetch.trim()}/full`;
      }

      const response = await fetch(endpoint, { signal: controller.signal })
      if (!response.ok) {
        let errorMessage = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // ignore json parse error
        }
        throw new Error(errorMessage)
      }
      const result = await response.json()
      setData(result)
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.log('Fetch aborted');
          return;
        }
        setError(err.message)
      } else {
        setError("An unknown error occurred")
      }
    } finally {
      // Only unset loading if this was the request that finished (not aborted)
      if (abortControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchData()
    }
  }

  const handlePlayerSelect = (selectedUsername: string) => {
    setUsername(selectedUsername);
    if (mode === 'compare') {
      setMode('profile');
    }
    setMode('profile');
    setTimeout(() => fetchData(selectedUsername), 0);
  };

  return (
    <GridBackground>
      <Navbar />
      <AnimatePresence mode="wait">
        {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
      </AnimatePresence>
      <div className="min-h-screen flex flex-col items-center pt-20 md:pt-24 p-4 space-y-8 text-foreground relative z-10">
        <HeroSection />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="relative w-full max-w-4xl mx-auto z-30"
        >

          <div className="relative flex flex-col md:flex-row items-center gap-2 bg-white dark:bg-neutral-900/90 backdrop-blur-xl p-1.5 rounded-2xl md:rounded-full border border-neutral-200 dark:border-neutral-800 shadow-2xl shadow-yellow-900/5">

            {/* Input Section */}
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 h-5 w-5" />
              <Input
                type="text"
                placeholder={mode === 'compare' ? "Username 1" : "Enter Chess.com username..."}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-12 h-12 md:h-14 bg-transparent border-transparent focus-visible:ring-0 text-base md:text-lg rounded-full placeholder:text-neutral-400"
              />
            </div>

            {mode === 'compare' && (
              <>
                <div className="hidden md:block w-[1px] h-8 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                <div className="relative flex-1 w-full md:w-auto">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 h-5 w-5" />
                  <Input
                    type="text"
                    placeholder="Username 2"
                    value={username2}
                    onChange={(e) => setUsername2(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-12 h-12 md:h-14 bg-transparent border-transparent focus-visible:ring-0 text-base md:text-lg rounded-full placeholder:text-neutral-400"
                  />
                </div>
              </>
            )}

            {/* Divider */}
            <div className="hidden md:block w-[1px] h-8 bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* Select & Action Group */}
            <div className="flex w-full md:w-auto items-center gap-2">
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="h-12 md:h-14 w-full md:w-[150px] border-transparent bg-transparent focus:ring-0 text-base font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-full transition-colors">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl border-neutral-200 dark:border-neutral-800 shadow-xl">
                  <SelectItem value="profile"><div className="flex items-center gap-2"><User className="h-4 w-4" /> Profile</div></SelectItem>
                  <SelectItem value="stats"><div className="flex items-center gap-2"><Activity className="h-4 w-4" /> Stats</div></SelectItem>
                  <SelectItem value="compare"><div className="flex items-center gap-2"><Swords className="h-4 w-4" /> Compare</div></SelectItem>
                  <SelectItem value="insights"><div className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Insights</div></SelectItem>
                </SelectContent>
              </Select>

              <MovingButton
                borderRadius="9999px"
                onClick={() => fetchData()}
                disabled={loading}
                type="button"
                className="bg-neutral-900 dark:bg-black text-white border-none font-bold text-base tracking-wide hover:bg-neutral-800 transition-colors shadow-lg"
                containerClassName="h-12 md:h-14 w-full md:w-32"
                duration={3000}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing</span>
                  </div>
                ) : "Analyze"}
              </MovingButton>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-sm font-medium bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-6xl"
            >
              <StatsSkeleton />
            </motion.div>
          ) : data ? (
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-6xl space-y-8 pb-8"
            >
              {mode === 'compare' && (data as ComparisonData).player1 && (data as ComparisonData).player2 ? (
                <ComparisonView
                  p1Data={(data as ComparisonData).player1}
                  p2Data={(data as ComparisonData).player2}
                  history={(data as ComparisonData).history}
                />
              ) : mode === 'insights' ? (
                <InsightsView data={data as any} />
              ) : mode === 'profile' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-3xl p-6 border border-black/5 dark:border-white/10 shadow-xl flex flex-col items-center text-center space-y-4 h-full">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full blur-lg opacity-50"></div>
                        <img
                          src={(data as PlayerData).avatar || `https://ui-avatars.com/api/?name=${(data as PlayerData).username}`}
                          alt={(data as PlayerData).username}
                          className="relative w-32 h-32 rounded-full border-4 border-white dark:border-neutral-800 shadow-lg object-cover"
                        />
                        {(data as PlayerData).league && (
                          <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full border-2 border-white dark:border-neutral-800">
                            {(data as PlayerData).league}
                          </div>
                        )}
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold">{(data as PlayerData).name || (data as PlayerData).username}</h2>
                        <a
                          href={(data as PlayerData).url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          @{(data as PlayerData).username}
                        </a>
                      </div>

                      <div className="grid grid-cols-2 gap-3 w-full pt-4">
                        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-3 rounded-xl">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Followers</p>
                          <p className="text-lg font-bold">{(data as PlayerData).followers}</p>
                        </div>
                        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-3 rounded-xl">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Country</p>
                          <p className="text-lg font-bold truncate">{(data as PlayerData).country?.split('/').pop() || 'Unknown'}</p>
                        </div>
                        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-3 rounded-xl">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Joined</p>
                          <p className="text-sm font-medium">{(data as PlayerData).joined_formatted || new Date(((data as PlayerData).joined || 0) * 1000).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-3 rounded-xl">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Active</p>
                          <p className="text-sm font-medium">{(data as PlayerData).last_online_formatted || new Date(((data as PlayerData).last_online || 0) * 1000).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {(data as PlayerData).clubs && (data as PlayerData).clubs!.length > 0 && (
                        <div className="w-full pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-4">
                          <h3 className="text-sm font-semibold mb-3 text-left">Clubs ({(data as PlayerData).clubs!.length})</h3>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {(data as PlayerData).clubs!.slice(0, 8).map((club: { url: string; name: string; icon: string }) => (
                              <a
                                key={club.url}
                                href={club.url}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative"
                                title={club.name}
                              >
                                <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1.5 border border-transparent group-hover:border-primary transition-all hover:scale-105 shadow-sm">
                                  <img
                                    src={club.icon}
                                    alt={club.name}
                                    className="w-full h-full object-contain rounded-lg"
                                  />
                                </div>
                              </a>
                            ))}
                            {(data as PlayerData).clubs!.length > 8 && (
                              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-muted-foreground border border-transparent">
                                +{(data as PlayerData).clubs!.length - 8}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="w-full pt-6 mt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <StatsReceipt data={data as PlayerData} />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-6">
                    <div className="bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-3xl p-1 border border-black/5 dark:border-white/5">
                      <StatsGrid data={data as PlayerData} />
                    </div>
                    {/* Add Chart here for Profile Mode too if data available */}
                    {(data as PlayerData).history && (data as PlayerData).history!.length > 0 && (
                      <ChartAreaInteractive
                        data={(data as PlayerData).history!.map(h => ({ date: h.date, player1: h.rating }))}
                        p1Name={(data as PlayerData).username}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold">Detailed Statistics</h2>
                    <div className="text-sm text-muted-foreground">
                      Data for <span className="font-semibold text-primary">@{(data as PlayerData).username}</span>
                    </div>
                  </div>
                  <StatsGrid data={(data as PlayerData)} />
                  {(data as PlayerData).history && (data as PlayerData).history!.length > 0 && (
                    <ChartAreaInteractive
                      data={(data as PlayerData).history!.map(h => ({ date: h.date, player1: h.rating }))}
                      p1Name={(data as PlayerData).username}
                    />
                  )}
                </div>
              )}

              <div className="w-full flex justify-center">
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {showJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showJson ? "Hide Raw Data" : "Show Raw Data"}
                </button>
              </div>

              <AnimatePresence>
                {showJson && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <pre className="bg-neutral-950 text-neutral-50 p-6 rounded-2xl overflow-auto max-h-[500px] text-xs font-mono border border-neutral-800 shadow-inner">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>



        <div className="mt-auto w-full py-6 flex flex-col items-end gap-8 z-50 px-4 md:px-8">
          <div className="w-full flex justify-center">
            <FloatingDockDemo onPlayerSelect={handlePlayerSelect} />
          </div>

          <div className="w-full flex flex-col items-center justify-center py-8 space-y-12">
            <PlayfulTodolist />
            <WallOfFame />
          </div>

          <div className="w-full">
            <WhatWeDo />
          </div>

          <div className="flex flex-col gap-2 items-end">
            <FeedbackForm />
          </div>

          <div className="w-full relative overflow-hidden mt-12 border-t border-white/10 bg-neutral-950">
            <div className="absolute inset-0 z-0">
              <Shader3 color="#000000" />
            </div>
            <div className="relative z-10 py-10">
              <TeamSection className="py-0 lg:py-10" />
            </div>
          </div>

        </div>
      </div>
    </GridBackground >
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/error" element={<AuthError />} />
      <Route path="/analysis/*" element={<AnalysisPage />} />
    </Routes>
  )
}

export default App
