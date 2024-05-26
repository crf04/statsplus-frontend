import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div>
      <h1>NBA Play Types</h1>
      <Link to="/team-stats">View Team Stats</Link>
    </div>
  );
}

export default Home;
