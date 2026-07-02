export function renderPagination(currentPage, totalRows, pageSize) {
  if (totalRows <= pageSize) return '';
  const totalPages = Math.ceil(totalRows / pageSize);
  let pageItems = '';
  for (let i = 1; i <= totalPages; i++) {
    const active = i === currentPage;
    pageItems += `<li class="page-item${active ? ' active' : ''}">
        <button class="page-link js-pagination-page" data-page="${i}"${active ? ' aria-current="page"' : ''}>${i}</button>
      </li>`;
  }
  return `<nav aria-label="Page navigation">
    <ul class="pagination flex-wrap mt-3">
      <li class="page-item${currentPage === 1 ? ' disabled' : ''}">
        <button class="page-link js-pagination-prev"${currentPage === 1 ? ' disabled' : ''}>Previous</button>
      </li>
      ${pageItems}
      <li class="page-item${currentPage >= totalPages ? ' disabled' : ''}">
        <button class="page-link js-pagination-next"${currentPage >= totalPages ? ' disabled' : ''}>Next</button>
      </li>
    </ul>
  </nav>`;
}

window.renderPagination = renderPagination;
