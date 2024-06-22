// src/HomePage.js
import React from 'react';

const HomePage = () => {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Welcome to My Simple Homepage</h1>
      </header>
      <main style={styles.main}>
        <p>This is a simple homepage created with React.</p>
        <p>Feel free to explore and add more components!</p>
      </main>
      <footer style={styles.footer}>
        <p>&copy; 2024 My Simple Homepage</p>
      </footer>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    padding: '0 20px',
  },
  header: {
    backgroundColor: '#282c34',
    padding: '20px',
    color: 'white',
  },
  main: {
    margin: '20px 0',
  },
  footer: {
    backgroundColor: '#282c34',
    padding: '10px',
    color: 'white',
    position: 'fixed',
    bottom: 0,
    width: '100%',
  },
};

export default HomePage;
