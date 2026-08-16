interface PluginRowProps {
  name: string;
  installsPerDay: string;
  activeInstalls: number;
  stars: string;
  numberOfRatings: number;
  supportThreads: number;
}

function createCell(text: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;

  return cell;
}

export function createPluginRow({
  name,
  installsPerDay,
  activeInstalls,
  stars,
  numberOfRatings,
  supportThreads,
}: PluginRowProps): HTMLTableRowElement {
  const row = document.createElement('tr');
  const nameCell = document.createElement('td');
  const nameText = document.createElement('strong');

  nameText.textContent = name;
  nameCell.append(nameText);

  row.append(
    nameCell,
    createCell(`~${installsPerDay} / day (${activeInstalls.toLocaleString()} total)`),
    createCell(`${stars} (${numberOfRatings})`),
    createCell(`${supportThreads} open`),
  );

  return row;
}
