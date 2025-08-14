// src/HomePage.js
import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

const HomePage = () => {
  const [showPromptingGuide, setShowPromptingGuide] = useState(false);
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>CourtAI</h1>
        <p style={styles.subtitle}>Advanced NBA Analytics Platform</p>
      </header>
      <main style={styles.main}>
        <p style={styles.description}>
          Discover powerful insights from NBA game data using natural language queries and advanced analytics.
        </p>
        <div style={styles.features}>
          <div 
            style={styles.feature}
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
          </div>
          <div 
            style={styles.feature}
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
          </div>
          <div 
            style={styles.feature}
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
          </div>
          <div 
            style={styles.feature}
            onClick={() => setShowPromptingGuide(true)}
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
            <h3>📝 Prompting Guide</h3>
            <p>Learn how to ask effective questions and get better insights</p>
          </div>
        </div>
      </main>
      <footer style={styles.footer}>
        <p>&copy; 2024 CourtAI - NBA Analytics Platform</p>
      </footer>

      {/* Prompting Guide Modal */}
      <Modal 
        show={showPromptingGuide} 
        onHide={() => setShowPromptingGuide(false)}
        size="lg"
        backdrop="static"
        style={styles.modal}
      >
        <Modal.Header closeButton style={styles.modalHeader}>
          <Modal.Title style={styles.modalTitle}>📝 Prompting Guide</Modal.Title>
        </Modal.Header>
        <Modal.Body style={styles.modalBody}>
          
          {/* Getting Started Section */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>🚀 Getting Started</h4>
            <div style={styles.content}>
              {/* Add your getting started content here */}
            </div>
          </div>

          {/* Player Queries Section */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>🏀 Player Queries</h4>
            <div style={styles.content}>
              <p>If you're looking for a player's stats, you can use the player's name in the natural language query.</p>
            </div>
          </div>

          {/* Team Queries Section */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>🏟️ Team Queries</h4>
            <div style={styles.content}>
              {/* Coming Soon! */}
            </div>
          </div>

          {/* Advanced Examples Section */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>⚡ Advanced Examples</h4>
            <div style={styles.content}>
              {/* Add your advanced query examples here */}
            </div>
          </div>

          {/* Pro Tips Section */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>💡 Pro Tips</h4>
            <div style={styles.content}>
              {/* Add your pro tips here */}
            </div>
          </div>

        </Modal.Body>
        <Modal.Footer style={styles.modalFooter}>
          <Button 
            variant="outline-warning" 
            onClick={() => setShowPromptingGuide(false)}
            style={styles.closeButton}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
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
  header: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    padding: '60px 20px',
    color: '#ffffff',
    borderBottom: '2px solid #f59e0b',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#cccccc',
    marginTop: '10px',
    fontWeight: '400',
  },
  main: {
    margin: '60px 20px',
    maxWidth: '1200px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  description: {
    fontSize: '1.1rem',
    color: '#cccccc',
    marginBottom: '50px',
    lineHeight: '1.6',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '30px',
    justifyItems: 'center',
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
  footer: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    padding: '20px',
    color: '#cccccc',
    borderTop: '1px solid #333333',
    marginTop: '80px',
  },
  modal: {
    color: '#ffffff',
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: 'none',
    borderBottom: '2px solid #f59e0b',
    color: '#ffffff',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  modalBody: {
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    color: '#ffffff',
    maxHeight: '70vh',
    overflowY: 'auto',
    padding: '30px',
  },
  modalFooter: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: 'none',
    borderTop: '1px solid #333333',
  },
  closeButton: {
    borderColor: '#f59e0b',
    color: '#f59e0b',
    fontWeight: '600',
  },
  section: {
    marginBottom: '30px',
    padding: '20px',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: '1px solid #333333',
    borderRadius: '12px',
    borderLeft: '4px solid #f59e0b',
  },
  sectionTitle: {
    color: '#f59e0b',
    marginBottom: '15px',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderBottom: '1px solid #333333',
    paddingBottom: '10px',
  },
  content: {
    color: '#cccccc',
    lineHeight: '1.6',
    fontSize: '0.95rem',
  },
};

export default HomePage;
