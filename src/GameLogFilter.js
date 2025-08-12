import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import axios from 'axios';
import { getApiUrl } from './config';
import './GameLogFilter.css';
import PlayerSelector from './PlayerSelector';
import FilterOptions from './FilterOptions';
import PlayerProfile from './PlayerProfile';
import OpposingTeamProfile from './OpposingTeamProfile';
import PerformanceAverages from './PerformanceAverages';
import ChartComponent from './ChartComponent';
import GameLogsTable from './GameLogsTable';
import NaturalLanguageQuery from './NaturalLanguageQuery';
import PlayerStatsCards from './PlayerStatsCards';
import { fetchUnfilteredGameLogs, fetchGameLogs } from './utils';

const GameLogFilter = () => {
  const [selectedPlayer, setSelectedPlayer] = useState('None');
  const [displayPlayer, setDisplayPlayer] = useState('None'); // For UI display (includes NL queries)
  const [selectedTeam, setSelectedTeam] = useState('');
  const [lineType, setLineType] = useState('PTS');
  const [lineValue, setLineValue] = useState('');
  const [gameLogs, setGameLogs] = useState([]);
  const [averages, setAverages] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [initialGameLogs, setInitialGameLogs] = useState([]);
  const [showLandingPage, setShowLandingPage] = useState(true); // Track if landing page should show
  const [currentQuery, setCurrentQuery] = useState(''); // Track the current search query
  const [resetToLanding, setResetToLanding] = useState(false); // Signal to reset NL component
  const [isGameLogsLoading, setIsGameLogsLoading] = useState(false); // Track game logs API loading

  useEffect(() => {
    axios.get(getApiUrl('PLAYERS'))
      .then(response => setPlayerList(response.data))
      .catch(error => console.error('Error fetching player list:', error));

    axios.get(getApiUrl('TEAMS'))
      .then(response => setTeams(response.data))
      .catch(error => console.error('Error fetching team list:', error));
  }, []);

  useEffect(() => {
    // Fetch unfiltered logs when selectedPlayer changes (manual selection)
    if (selectedPlayer !== 'None') {
      fetchUnfilteredGameLogs(selectedPlayer, setGameLogs, setAverages, setInitialGameLogs, (team) => {
        // If no opposing team is provided, set the first available team as default
        if (!team && teams.length > 0) {
          setSelectedTeam(teams[0]);
        } else {
          setSelectedTeam(team);
        }
      });
      // Update display player to match selected player for manual selection
      setDisplayPlayer(selectedPlayer);
    }
  }, [selectedPlayer, teams]);

  const handleApplyFilters = (filterParams, isFromNL = false) => {
    const cleanedFilters = Object.fromEntries(
      Object.entries(filterParams).filter(([_, value]) => 
        value !== null && value !== '' && 
        !(Array.isArray(value) && value.length === 0)
      )
    );
    
    // Remove default playstyle values for UI display unless explicitly set
    const appliedFiltersForUI = { ...cleanedFilters };
    if (isFromNL && (filterParams.playstyle_RTG_min === undefined || filterParams.playstyle_RTG_max === undefined ||
        !filterParams.playstyle_RTG_min || !filterParams.playstyle_RTG_max)) {
      delete appliedFiltersForUI.playstyle_RTG_min;
      delete appliedFiltersForUI.playstyle_RTG_max;
    }
    
    // Final cleanup: remove any undefined values
    const finalFilters = Object.fromEntries(
      Object.entries(appliedFiltersForUI).filter(([_, value]) => value !== undefined)
    );
    setAppliedFilters(finalFilters);
    
    // For natural language queries, also update initialGameLogs and selectedTeam
    if (isFromNL) {
      setIsGameLogsLoading(true);
      fetchGameLogs(cleanedFilters, setGameLogs, setAverages, setInitialGameLogs, (team) => {
        // If no opposing team is provided, set the first available team as default
        if (!team && teams.length > 0) {
          setSelectedTeam(teams[0]);
        } else {
          setSelectedTeam(team);
        }
      })
        .then(() => {
          setIsGameLogsLoading(false);
        })
        .catch(() => {
          setIsGameLogsLoading(false);
        });
    } else {
      fetchGameLogs(cleanedFilters, setGameLogs, setAverages, null, setSelectedTeam);
    }
  };

  // Handler for natural language query results
  const handleNLQueryResults = (filters) => {
    console.log('handleNLQueryResults called with filters:', filters);
    
    // Hide landing page when search is made
    setShowLandingPage(false);
    
    // Apply filters received from natural language processing
    if (filters && Object.keys(filters).length > 0) {
      // If player is included, make API call first, then set player
      if (filters.selectedPlayer) {
        // Convert selectedPlayer to player_name for API compatibility
        const apiFilters = { ...filters };
        apiFilters.player_name = filters.selectedPlayer;
        delete apiFilters.selectedPlayer;
        
        // Make the filtered API call
        const cleanedFilters = Object.fromEntries(
          Object.entries(apiFilters).filter(([_, value]) => 
            value !== null && value !== '' && 
            !(Array.isArray(value) && value.length === 0)
          )
        );
        
        console.log('About to call fetchGameLogs with cleanedFilters:', cleanedFilters);
        
        // Remove default playstyle values that weren't explicitly set by user
        const appliedFiltersForUI = { ...cleanedFilters };
        // Don't show playstyle range if values are undefined or not explicitly set
        if (apiFilters.playstyle_RTG_min === undefined || apiFilters.playstyle_RTG_max === undefined ||
            !apiFilters.playstyle_RTG_min || !apiFilters.playstyle_RTG_max) {
          delete appliedFiltersForUI.playstyle_RTG_min;
          delete appliedFiltersForUI.playstyle_RTG_max;
        }
        
        // Final cleanup: remove any undefined values
        const finalFilters = Object.fromEntries(
          Object.entries(appliedFiltersForUI).filter(([_, value]) => value !== undefined)
        );
        setAppliedFilters(finalFilters);
        
        // Set loading state for game logs API
        setIsGameLogsLoading(true);
        
        // For NL queries, only set displayPlayer (selectedPlayer is set when filters are applied)
        fetchGameLogs(cleanedFilters, setGameLogs, setAverages, setInitialGameLogs, (team) => {
          // If no opposing team is provided, set the first available team as default
          if (!team && teams.length > 0) {
            setSelectedTeam(teams[0]);
          } else {
            setSelectedTeam(team);
          }
        })
          .then(() => {
            // Only set displayPlayer for NL queries
            // selectedPlayer will be set when user applies filters
            setDisplayPlayer(filters.selectedPlayer);
            setIsGameLogsLoading(false); // Clear loading state
          })
          .catch(error => {
            console.error('Error fetching natural language query results:', error);
            setIsGameLogsLoading(false); // Clear loading state on error
          });
      } else {
        handleApplyFilters(filters, true); // Pass true for isFromNL
      }
    }
  };

  // Handler for player selection from natural language (no longer triggers separate API call)
  const handleNLPlayerSelection = (playerName) => {
    // This is now handled in handleNLQueryResults to avoid duplicate API calls
    // Keeping this function for potential future use
    return;
  };

  return (
    <>
      {/* Always render NaturalLanguageQuery - it handles landing page vs compact view internally */}
      <NaturalLanguageQuery
        onFiltersApplied={handleNLQueryResults}
        onPlayerSelected={handleNLPlayerSelection}
        onQueryUpdate={setCurrentQuery}
        resetToLanding={resetToLanding}
        gameLogsLoading={isGameLogsLoading}
      />
      
      {/* Player Stats Cards - positioned between search and main content */}
      {!showLandingPage && (
        <Container fluid className="pt-2 pb-1">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <button 
              onClick={() => {
                setShowLandingPage(true);
                setCurrentQuery('');
                setResetToLanding(true);
                // Reset the flag after a brief delay to allow the effect to trigger
                setTimeout(() => setResetToLanding(false), 100);
              }}
              className="btn btn-back-to-search d-flex align-items-center"
              aria-label="Back to search"
            >
              ←
            </button>
            {currentQuery && (
              <div className="current-query-display">
                <span className="query-label">Query:</span>
                <span className="query-text">"{currentQuery}"</span>
              </div>
            )}
          </div>
          <Card className="dark-card">
            <Card.Body className="p-3">
              <PlayerStatsCards 
                averages={averages}
                selectedPlayer={displayPlayer}
              />
            </Card.Body>
          </Card>
        </Container>
      )}
      
      {/* Only show main content after landing page */}
      {!showLandingPage && (
        <Container fluid className="game-log-filter py-2">
          <Row className="mb-5">
            <Col md={8}>
              <Card className="dark-card">
                <Card.Body>
                  <PlayerSelector
                    selectedPlayer={displayPlayer}
                    setSelectedPlayer={(player) => {
                      setSelectedPlayer(player);
                      setDisplayPlayer(player);
                      setShowLandingPage(false); // Hide landing page on manual selection
                    }}
                    lineType={lineType}
                    setLineType={setLineType}
                    lineValue={lineValue}
                    setLineValue={setLineValue}
                    playerList={playerList}
                    averages={averages}
                  />
                  <ChartComponent
                    gameLogs={gameLogs}
                    lineType={lineType}
                    lineValue={lineValue}
                    selectedPlayer={displayPlayer}
                    averages={averages}
                    appliedFilters={appliedFilters}
                  />
                  
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <FilterOptions
                playerList={playerList}
                onApplyFilters={handleApplyFilters}
                selectedPlayer={selectedPlayer}
                displayPlayer={displayPlayer}
                gameLogs={gameLogs}
                initialGameLogs={initialGameLogs}
                appliedFilters={appliedFilters}
              />
            </Col>
          </Row>
          
          <Row className="mb-5">
            <Col md={6}>
              <PlayerProfile 
                selectedPlayer={displayPlayer} 
                selectedTeam={selectedTeam} 
              />
            </Col>
            <Col md={6}>
              <OpposingTeamProfile 
                teams={teams} 
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
              />
            </Col>
          </Row>

          <div className="stats-layout-container">
            <div className="per36-sidebar">
              <PerformanceAverages averages={averages} appliedFilters={appliedFilters} />
            </div>
            
            <div className="game-logs-main">
              <GameLogsTable gameLogs={gameLogs} appliedFilters={appliedFilters} />
            </div>
          </div>

        </Container>
      )}
    </>
  );
};

export default GameLogFilter;