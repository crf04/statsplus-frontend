// src/HomePage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Welcome to CourtAI</h1>
          <p style={styles.heroSubtitle}>Advanced NBA Analytics Platform</p>
          <p style={styles.description}>
            Discover powerful insights from NBA game data using natural language queries and advanced analytics.
          </p>
        </div>
        
        <div style={styles.features}>
          <div 
            style={styles.feature}
            onClick={() => handleNavigation('/game-logs')}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
              e.target.style.borderColor = '#f59e0b';
              e.target.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.borderColor = '#333333';
              e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
            }}
          >
            <h3>🏀 Player Analytics</h3>
            <p>Deep dive into player statistics and performance metrics</p>
            <div style={styles.navHint}>Click to explore →</div>
          </div>
          <div 
            style={styles.feature}
            onClick={() => handleNavigation('/game-logs')}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
              e.target.style.borderColor = '#f59e0b';
              e.target.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.borderColor = '#333333';
              e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
            }}
          >
            <h3>🤖 AI-Powered Queries</h3>
            <p>Ask questions in natural language and get instant insights</p>
            <div style={styles.navHint}>Click to explore →</div>
          </div>
          <div 
            style={styles.feature}
            onClick={() => handleNavigation('/team-matchup')}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
              e.target.style.borderColor = '#f59e0b';
              e.target.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.borderColor = '#333333';
              e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
            }}
          >
            <h3>⚔️ Team Matchups</h3>
            <p>Compare team statistics and analyze head-to-head matchups</p>
            <div style={styles.navHint}>Click to explore →</div>
          </div>
          <div 
            style={styles.feature}
            onClick={() => handleNavigation('/game-logs')}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
              e.target.style.borderColor = '#f59e0b';
              e.target.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.borderColor = '#333333';
              e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
            }}
          >
            <h3>📊 Advanced Filtering</h3>
            <p>Filter by matchups, teammates, location, and more</p>
            <div style={styles.navHint}>Click to explore →</div>
          </div>
        </div>
      </main>
      <footer style={styles.footer}>
        <p>&copy; 2024 CourtAI - NBA Analytics Platform</p>
      </footer>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
    textAlign: 'center',
    padding: '0',
    background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 20%, #111111 50%, #0d0d0d 100%)',
    color: '#ffffff',
    minHeight: '100vh',
  },
  main: {
    margin: '40px 20px',
    maxWidth: '1200px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  hero: {
    marginBottom: '60px',
    padding: '40px 0',
  },
  heroTitle: {
    fontSize: '3rem',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '15px',
    background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: '1.4rem',
    color: '#cccccc',
    marginBottom: '20px',
    fontWeight: '400',
  },
  description: {
    fontSize: '1.1rem',
    color: '#cccccc',
    marginBottom: '50px',
    lineHeight: '1.6',
    maxWidth: '800px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  features: {
    display: 'flex',
    justifyContent: 'space-around',
    gap: '30px',
    flexWrap: 'wrap',
  },
  feature: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: '1px solid #333333',
    borderRadius: '12px',
    padding: '30px 20px',
    maxWidth: '300px',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
  },
  navHint: {
    marginTop: '15px',
    fontSize: '0.9rem',
    color: '#f59e0b',
    fontWeight: '500',
    opacity: '0.8',
  },
  footer: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    padding: '20px',
    color: '#cccccc',
    borderTop: '1px solid #333333',
    marginTop: '80px',
  },
};

export default HomePage;
