# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-06-04

### Added
- **🔄 Dual API Data Collection System**
  - Added NaverGraphQLScraper for enhanced data collection using GraphQL API
  - Implemented dual scraper architecture for comprehensive data coverage
  - Added intelligent data integration with business name deduplication
  
- **🔧 Enhanced Data Processing**
  - Added `combineDataSources()` method in DataProcessor for smart data merging
  - Implemented business name-based duplicate detection and removal
  - Added data source tracking (naver_map vs graphql) in collected data
  - Enhanced statistics with source distribution information

- **📊 Improved Analytics**
  - Added GraphQL-specific collection statistics
  - Enhanced duplicate removal reporting with source breakdown
  - Added data source distribution in final statistics
  - Improved logging with API source identification

- **🛠️ Technical Improvements**
  - Added retry logic with exponential backoff for GraphQL API
  - Implemented proper error handling for dual API system
  - Added progress tracking for both collection phases
  - Enhanced data validation and cleaning processes

### Changed
- **Data Collection Flow**: Now uses two-phase collection (Map API → GraphQL API → Integration)
- **Statistics Calculation**: Enhanced to include source distribution and integration metrics
- **Data Schema**: Added '데이터소스' field to track data origin
- **Progress Reporting**: Improved to show progress for both API sources separately

### Enhanced
- **Data Coverage**: Significantly improved by using multiple API endpoints
- **Duplicate Handling**: More sophisticated deduplication based on business names
- **User Experience**: Better progress reporting and detailed collection statistics
- **Documentation**: Comprehensive README with dual API architecture explanation

### Technical Details
- **New Files**:
  - `src/scrapers/naverGraphQLScraper.js` - GraphQL API scraper implementation
  - Updated `src/utils/dataProcessor.js` - Enhanced with data integration capabilities
  - Updated `src/main.js` - Integrated dual scraper system
  - Added comprehensive `README.md` - Detailed documentation

- **API Integration**:
  - Primary: Naver Map Search API (existing)
  - Secondary: Naver GraphQL Places API (new)
  - Integration: Business name-based deduplication

## [1.0.0] - 2024-12-XX

### Added
- Initial release of shared-office finder
- Basic Naver Map API data collection
- Regional search capabilities
- Keyword-based filtering
- Excel and JSON export functionality
- Electron-based desktop application
- Data deduplication and cleaning
- Progress tracking and logging
- User settings persistence

### Features
- **Data Collection**
  - Naver Map API integration
  - Regional (province/district) search
  - Keyword and exclude keyword filtering
  - Pagination support for large datasets

- **Data Processing**
  - Automatic duplicate removal
  - Phone number formatting
  - Address standardization
  - Data validation and cleaning

- **Export Options**
  - Excel (.xlsx) format with proper column formatting
  - JSON format with metadata
  - Customizable file naming

- **User Interface**
  - Intuitive Electron desktop application
  - Real-time progress tracking
  - Detailed logging and statistics
  - Customizable region and keyword selection

- **Configuration**
  - User settings persistence
  - Default keyword management
  - Regional selection preferences
  - Error handling and retry logic

---

## Version History Summary

### v1.1.0 (Current)
- **Dual API System**: Added GraphQL API for enhanced data collection
- **Smart Integration**: Intelligent deduplication and data merging
- **Improved Coverage**: Significantly more comprehensive data collection

### v1.0.0
- **Initial Release**: Basic Naver Map API scraping functionality
- **Core Features**: Regional search, keyword filtering, export capabilities
- **Desktop App**: Electron-based user interface with progress tracking