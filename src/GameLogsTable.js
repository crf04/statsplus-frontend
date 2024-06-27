import React from 'react';
import { useTable, useSortBy } from 'react-table';
import 'bootstrap/dist/css/bootstrap.min.css';
import './GameLogFilter.css'; // Import the custom CSS file

const GameLogsTable = ({ gameLogs }) => {
  const columns = React.useMemo(
    () => Object.keys(gameLogs[0] || {}).map(key => ({
      Header: key,
      accessor: key
    })),
    [gameLogs]
  );

  const data = React.useMemo(() => gameLogs, [gameLogs]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns, data }, useSortBy);

  return (
    <div>
      {gameLogs.length > 0 ? (
        <table {...getTableProps()} className="table table-no-gridlines">
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                    {column.render('Header')}
                    <span>
                      {column.isSorted
                        ? column.isSortedDesc
                          ? ' 🔽'
                          : ' 🔼'
                        : ''}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(row => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p>No game logs to display</p>
      )}
    </div>
  );
};

export default GameLogsTable;
