import random
import time

import pyxel


class NumberPuzzleApp:
    BOARD_SIZE = 4
    TILE_SIZE = 34
    PADDING = 12
    HEADER_HEIGHT = 56
    FOOTER_HEIGHT = 42
    ROW_COLORS = (8, 9, 10, 12)
    WINDOW_WIDTH = PADDING * 2 + TILE_SIZE * BOARD_SIZE
    WINDOW_HEIGHT = HEADER_HEIGHT + PADDING + TILE_SIZE * BOARD_SIZE + FOOTER_HEIGHT
    SHUFFLE_MOVES = 320

    def __init__(self):
        self.board = []
        self.blank_index = self.BOARD_SIZE * self.BOARD_SIZE - 1
        self.move_count = 0
        self.start_time = time.time()
        self.clear_time = None
        self.is_cleared = False

        pyxel.init(
            self.WINDOW_WIDTH,
            self.WINDOW_HEIGHT,
            title="Number Puzzle",
            fps=30,
        )
        self.reset_game()
        pyxel.run(self.update, self.draw)

    def reset_game(self):
        self.board = list(range(1, self.BOARD_SIZE * self.BOARD_SIZE)) + [0]
        self.blank_index = len(self.board) - 1

        previous_blank = -1
        for _ in range(self.SHUFFLE_MOVES):
            movable = [
                index
                for index in self.get_adjacent_indices(self.blank_index)
                if index != previous_blank
            ]
            if not movable:
                movable = self.get_adjacent_indices(self.blank_index)
            chosen_index = random.choice(movable)
            previous_blank = self.blank_index
            self.swap_with_blank(chosen_index)

        if self.is_solved():
            self.reset_game()
            return

        self.move_count = 0
        self.start_time = time.time()
        self.clear_time = None
        self.is_cleared = False

    def get_adjacent_indices(self, index):
        row, col = divmod(index, self.BOARD_SIZE)
        adjacent = []
        if row > 0:
            adjacent.append(index - self.BOARD_SIZE)
        if row < self.BOARD_SIZE - 1:
            adjacent.append(index + self.BOARD_SIZE)
        if col > 0:
            adjacent.append(index - 1)
        if col < self.BOARD_SIZE - 1:
            adjacent.append(index + 1)
        return adjacent

    def swap_with_blank(self, tile_index):
        self.board[self.blank_index], self.board[tile_index] = (
            self.board[tile_index],
            self.board[self.blank_index],
        )
        self.blank_index = tile_index

    def try_move_tile(self, tile_index):
        if tile_index not in self.get_adjacent_indices(self.blank_index):
            return False

        self.swap_with_blank(tile_index)
        self.move_count += 1

        if self.is_solved():
            self.is_cleared = True
            self.clear_time = time.time()
        return True

    def handle_keyboard(self):
        if pyxel.btnp(pyxel.KEY_R):
            self.reset_game()
            return

        if self.is_cleared:
            if pyxel.btnp(pyxel.KEY_N):
                self.reset_game()
            return

        target = None
        if pyxel.btnp(pyxel.KEY_LEFT) or pyxel.btnp(pyxel.KEY_A):
            if self.blank_index % self.BOARD_SIZE < self.BOARD_SIZE - 1:
                target = self.blank_index + 1
        elif pyxel.btnp(pyxel.KEY_RIGHT) or pyxel.btnp(pyxel.KEY_D):
            if self.blank_index % self.BOARD_SIZE > 0:
                target = self.blank_index - 1
        elif pyxel.btnp(pyxel.KEY_UP) or pyxel.btnp(pyxel.KEY_W):
            if self.blank_index // self.BOARD_SIZE < self.BOARD_SIZE - 1:
                target = self.blank_index + self.BOARD_SIZE
        elif pyxel.btnp(pyxel.KEY_DOWN) or pyxel.btnp(pyxel.KEY_S):
            if self.blank_index // self.BOARD_SIZE > 0:
                target = self.blank_index - self.BOARD_SIZE

        if target is not None:
            self.try_move_tile(target)

    def handle_mouse(self):
        if not pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT):
            return

        mouse_x = pyxel.mouse_x - self.PADDING
        mouse_y = pyxel.mouse_y - self.HEADER_HEIGHT
        if mouse_x < 0 or mouse_y < 0:
            return

        col = mouse_x // self.TILE_SIZE
        row = mouse_y // self.TILE_SIZE
        if col >= self.BOARD_SIZE or row >= self.BOARD_SIZE:
            return

        tile_index = row * self.BOARD_SIZE + col
        if tile_index != self.blank_index:
            self.try_move_tile(tile_index)

    def is_solved(self):
        solved = list(range(1, self.BOARD_SIZE * self.BOARD_SIZE)) + [0]
        return self.board == solved

    def elapsed_seconds(self):
        if self.clear_time is not None:
            return int(self.clear_time - self.start_time)
        return int(time.time() - self.start_time)

    def update(self):
        pyxel.mouse(True)
        self.handle_keyboard()
        if not self.is_cleared:
            self.handle_mouse()

    def draw(self):
        pyxel.cls(1)
        self.draw_header()
        self.draw_board()
        self.draw_footer()

    def draw_header(self):
        pyxel.rect(0, 0, self.WINDOW_WIDTH, self.HEADER_HEIGHT - 6, 0)
        pyxel.text(12, 12, "NUMBER PUZZLE", 7)
        pyxel.text(12, 26, f"MOVES: {self.move_count:03}", 10)
        pyxel.text(92, 26, f"TIME: {self.elapsed_seconds():03}s", 11)
        pyxel.text(12, 40, "ARROWS/WASD OR CLICK / R:RESET", 6)

    def draw_board(self):
        board_x = self.PADDING
        board_y = self.HEADER_HEIGHT
        pyxel.rect(board_x - 2, board_y - 2, self.TILE_SIZE * self.BOARD_SIZE + 4, self.TILE_SIZE * self.BOARD_SIZE + 4, 5)

        for index, value in enumerate(self.board):
            row, col = divmod(index, self.BOARD_SIZE)
            x = board_x + col * self.TILE_SIZE
            y = board_y + row * self.TILE_SIZE

            if value == 0:
                pyxel.rect(x, y, self.TILE_SIZE - 2, self.TILE_SIZE - 2, 0)
                pyxel.rectb(x, y, self.TILE_SIZE - 2, self.TILE_SIZE - 2, 1)
                continue

            solved_row = (value - 1) // self.BOARD_SIZE
            color = self.ROW_COLORS[solved_row]
            pyxel.rect(x, y, self.TILE_SIZE - 2, self.TILE_SIZE - 2, color)
            pyxel.rectb(x, y, self.TILE_SIZE - 2, self.TILE_SIZE - 2, 7)

            text = str(value)
            text_x = x + (self.TILE_SIZE // 2) - (len(text) * 2)
            text_y = y + (self.TILE_SIZE // 2) - 3
            pyxel.text(text_x, text_y, text, 0)

    def draw_footer(self):
        footer_y = self.HEADER_HEIGHT + self.TILE_SIZE * self.BOARD_SIZE + 10
        if self.is_cleared:
            pyxel.text(32, footer_y + 6, "CLEAR! PRESS N", 10)
            pyxel.text(38, footer_y + 16, "FOR NEW GAME", 10)
        else:
            pyxel.text(18, footer_y + 2, "ARRANGE 1-15 IN ORDER", 7)
            pyxel.text(16, footer_y + 12, "LEAVE THE LAST SPACE EMPTY", 7)


if __name__ == "__main__":
    NumberPuzzleApp()
