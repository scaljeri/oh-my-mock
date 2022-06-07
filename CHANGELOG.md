# Change Log

All notable changes to this project will be documented in this file.

## [Unreleased] - yyyy-mm-dd

### Added

### Changed

### Fixed

## [3.3.14] - 2022-05-27

### Changed

- [XHR readyState support](https://github.com/scaljeri/oh-my-mock/issues/139)
  readyState now emits values 1, 2, 3 and 4

### Fixed

- [New installs do not activate](https://github.com/scaljeri/oh-my-mock/issues/138)
  The first time (new install) ignores the on/off toggle in the popup header

## [3.3.13] - 2022-05-25

### Changed

- [Filtering in Background script](https://github.com/scaljeri/oh-my-mock/issues/124)
  In order to remove the flikker while filtering request, filtering is partially moved to the
  background script and applied when mocks are added/changed

### Fixed

- [Flikkering filter results](https://github.com/scaljeri/oh-my-mock/issues/137)
  Every update causes the filtered list to be repainted

## [3.3.12] - 2022-05-23

### Changed

- [Migrate to V3 seearch](https://github.com/scaljeri/oh-my-mock/issues/124)
  Migration of chrome extension V2 to V3

## [3.3.11] - 2022-05-15

### Added

### Changed

- [Deep seearch](https://github.com/scaljeri/oh-my-mock/issues/135)
  The filter option above the reques list is now configurable and does deep searching (includes mock response boies, headers, etc)

### Fixed

- [Long request URLs](https://github.com/scaljeri/oh-my-mock/issues/136)
  Inside the Request list long request urls are ellipsed in the middle

## [3.3.10] - ?????
