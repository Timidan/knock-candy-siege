#!/usr/bin/env python3
"""Ten portrait-specific Chog heads; writes only the legend masters, atlas and preview.

Run: python -B art/siege/chogs/build_legend.py
Legendary traits are unique: each portrait is its own sole design reference.
"""
import sys
sys.dont_write_bytecode = True
import io
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageOps
from build_chogs import (ATLAS, HERE, DATA, INK, CREAM, BLUSH, SIZE, ANCHORS,
                         path, ellipse, drawings, svg, write, save_png, save_json, font)
from compose import Compositor

IDS = (561, 900, 942, 1002, 1481, 1514, 1667, 1798, 1881, 1884)
BASE = drawings()


def fur(color, shade, light):
    return BASE['base/back'].replace('#eeeeee', color).replace('#cdcdcd', shade).replace('#fafafa', light).replace('#181818', INK)


def face(color=CREAM, shade='#e2c8ad'):
    return BASE['base/face'].replace(CREAM, color).replace('#e2c8ad', shade)


def ember():
    a = fur('#ffc936', '#ec692a', '#ffe95b')
    a += path('M49 171 Q48 143 68 128 L83 120 98 133 115 119 128 129 '
              '141 119 158 133 173 120 188 128 Q208 147 207 175 '
              'Q211 207 191 221 Q169 234 128 233 Q87 234 65 221 Q46 207 49 171Z', '#f39b21', 'none', 0)
    a += path('M50 189 Q75 213 128 214 Q181 213 206 189 Q207 211 190 222 '
              'Q168 234 128 233 Q88 234 66 222 Q49 211 50 189Z', '#ec692a', 'none', 0)
    for x in (92, 164):
        a += ellipse(x, 170, 22, 22, '#ffdb3b') + ellipse(x, 170, 18, 18, '#fff678')
    for x in (63, 193):
        a += ellipse(x, 196, 11, 12, 'none', '#ffc64d', 2)
    a += path('M119 200 Q128 210 137 200', 'none', '#ffe974', 3.4)
    return a


def skull():
    a = path('M69 229 Q41 222 28 200 L40 199 Q20 177 27 151 L40 164 '
             'Q23 128 30 105 L44 125 Q39 88 57 67 L58 95 '
             'Q75 73 71 49 Q93 66 90 94 Q109 76 128 45 '
             'Q147 76 166 94 Q163 66 185 49 Q181 73 198 95 '
             'L199 67 Q217 88 212 125 L226 105 Q233 128 216 164 '
             'L229 151 Q236 177 216 199 L228 200 Q215 222 187 229 '
             'Q159 240 128 236 Q97 240 69 229Z', '#f07b23', INK, 4.5)
    a += path('M59 217 Q35 185 48 157 L51 177 Q64 152 59 124 '
              'Q78 137 79 158 L92 130 104 158 152 158 164 130 '
              'Q177 153 177 158 Q178 137 197 124 Q192 152 205 177 '
              'L208 157 Q221 185 197 217 Q166 234 128 229 Q90 234 59 217Z', '#ffe931', 'none', 0)
    a += path('M83 100 Q128 78 173 100 Q198 112 198 145 L195 170 '
              'Q192 183 179 188 L179 208 Q170 232 128 232 '
              'Q86 232 77 208 L77 188 Q64 183 61 170 L58 145 Q58 112 83 100Z', CREAM, INK, 4.5)
    a += path('M61 146 Q69 174 83 184 L86 204 Q98 222 128 224 '
              'Q158 222 170 204 L173 184 Q187 174 195 146 L195 170 '
              'Q192 183 179 188 L179 208 Q170 232 128 232 Q86 232 77 208 '
              'L77 188 Q64 183 61 170Z', '#d9c7a8', 'none', 0)
    socket = path('M76 148 Q92 145 108 160 Q116 183 97 188 '
                  'Q75 191 72 173 Q68 157 76 148Z', '#1d1a20', '#9c7239', 3)
    socket += path('M75 167 Q76 184 96 184', 'none', '#ca8b47', 3)
    a += socket + f'<g transform="translate(256 0) scale(-1 1)">{socket}</g>'
    a += path('M120 177 Q128 174 136 177 L134 187 128 191 122 187Z', '#ae7840', 'none', 0)
    a += path('M128 179 128 185', 'none', '#f5e6bf', 2)
    a += path('M85 197 Q128 204 171 197 L170 216 Q128 232 86 216Z', '#9c784f', INK, 2.8)
    for x, y in ((92,202),(106,205),(120,206),(136,206),(150,205),(164,202)):
        a += ellipse(x, y, 4.7, 8, '#f8eed6', '#916e3e', 2)
        a += ellipse(x, y+10, 4.5, 6.8, '#f8eed6', '#916e3e', 2)
    a += path('M90 98 86 117 96 131M86 116 78 120M168 97 158 117 166 131 158 141', 'none', '#977749', 2.4)
    a += path('M67 181 70 185M189 181 186 185', 'none', '#d95796', 4)
    return a


def scream():
    a = fur('#5630b3', '#382076', '#7850cf')
    a += path('M55 172 Q56 145 67 132 Q67 103 80 106 Q88 108 91 129 '
              'Q98 143 105 121 Q111 99 121 115 L128 131 '
              'Q135 105 145 110 Q154 114 155 133 Q165 109 176 116 '
              'Q184 121 183 136 Q201 144 202 172 Q203 199 187 212 '
              'Q164 225 153 230 Q128 241 103 230 Q92 225 69 212 Q53 199 55 172Z', '#f3d586', INK, 4)
    a += path('M67 144 Q64 179 83 195 L105 219 118 231 Q95 224 88 210 '
              'L65 198 Q55 180 61 159Z M178 145 Q196 164 188 184 '
              'L174 201 Q163 212 146 232 L158 229 185 215 Q207 190 198 166Z', '#e7b975', 'none', 0)
    for x in (92, 164):
        a += ellipse(x, 166, 18, 25, '#f5e4a8', '#dfb777', 2)
        a += ellipse(x-3, 163, 3.5, 6, '#56394f', rotate=8)
    a += path('M54 184 Q65 192 79 187 Q83 199 67 204 L56 198Z '
              'M202 184 Q191 192 177 187 Q173 199 189 204 L200 198Z', '#df4c94', 'none', 0)
    a += BASE['base/nose']
    a += ellipse(128, 209, 12, 19, '#e4ba7a', '#ad835d', 2.5)
    a += ellipse(128, 209, 5.5, 14, '#f2d292', '#b98e60', 2)
    a += path('M125 196 125 217M133 201 132 217', 'none', '#c9a272', 1.5)
    return a


def zombie():
    a = fur('#574082', '#342342', '#796196')
    a += path('M52 171 48 158 57 152 53 143 65 141 62 128 76 133 '
              'L75 118 88 125 94 120 102 137 108 128 111 115 118 124 '
              'L128 133 136 120 142 125 148 114 155 128 163 121 165 136 '
              'L176 123 182 133 190 128 194 143 203 140 202 153 '
              'L212 158 204 172 213 181 204 190 211 200 201 202 202 213 '
              'L190 214 Q171 231 128 233 Q85 231 66 214 L54 213 55 202 '
              'L45 200 52 190 43 181Z', '#d5e4b7', INK, 4)
    a += path('M52 197 Q74 219 100 224 Q128 233 156 224 Q182 219 204 197 '
              'L201 202 202 213 190 214 Q171 231 128 233 Q85 231 66 214 '
              'L54 213 55 202Z', '#a3bd85', 'none', 0)
    a += path('M58 140 64 113 79 99 95 96 111 109 115 129 105 135 '
              'L105 148 95 136 84 145 77 130 71 143Z', '#bc5862', INK, 3)
    a += path('M49 126 Q32 129 36 115 Q27 105 36 94 Q28 80 45 74 '
              'Q43 56 60 59 Q67 45 82 57 Q98 50 110 66 Q122 66 118 82 '
              'Q129 97 114 102 Q112 117 98 113 L96 128 82 118 '
              'Q80 137 67 128 L62 137Z', '#ed8489', INK, 4)
    a += path('M45 74 Q64 67 69 82 Q75 96 61 99 Q59 107 68 112 '
              'M61 59 Q80 61 79 72 M82 57 Q93 73 108 71 '
              'M92 78 Q105 87 113 82 M81 80 Q68 70 64 62 '
              'M78 84 Q94 82 95 95 Q95 108 84 112 L83 123 '
              'M44 86 Q34 99 46 106 L48 119 M49 83 Q60 81 59 92 '
              'M44 103 Q55 102 57 116 L56 128 M101 93 Q110 93 111 105', 'none', '#70363c', 2.5)
    for x in (92, 164):
        a += ellipse(x, 170, 19, 19, '#131d19', INK, 3)
        a += path(f'M{x-14} 182 Q{x} 191 {x+15} 176', 'none', '#537044', 2)
        a += ellipse(x+4, 164, 5.5, 5, '#78bf65') + ellipse(x+4, 162, 2, 2, '#e6f4d8')
    a += BASE['base/blush'] + BASE['base/nose']
    a += path('M81 201 Q86 188 128 189 Q170 188 175 201 Q182 219 155 225 '
              'Q128 233 101 225 Q74 219 81 201Z', '#522f31', INK, 4)
    a += path('M87 208 Q128 218 170 200 L168 215 Q128 233 90 218Z', '#331f24', 'none', 0)
    for x,y in ((88,198),(103,194),(119,192),(136,192),(152,194),(167,198)):
        a += path(f'M{x-5} {y} {x+4} {y-1} {x+3} {y+10} Q{x} {y+16} {x-5} {y+9}Z', '#f5efda', '#29352d', 2)
    for x,y in ((96,219),(112,225),(128,226),(144,225),(160,219)):
        a += path(f'M{x-4} {y} {x-3} {y-9} Q{x+2} {y-17} {x+5} {y-7} L{x+5} {y-2}Z', '#e9e6cc', '#29352d', 2)
    a += path('M85 211 Q88 207 92 211 L96 228 100 216 Q105 210 109 218 '
              'L109 247 Q107 256 102 251 L101 235 96 258 Q92 267 88 259 '
              'L89 236 Q80 235 83 225Z', '#b8df78', INK, 2.7)
    a += path('M91 222 91 237M104 219 103 238', 'none', '#eaf5bb', 2)
    a += path('M66 147 70 152M90 140 94 143M117 196 122 200', 'none', '#b64465', 3)
    return a


def frog():
    a = path('M54 221 Q30 203 32 168 L34 111 Q35 93 46 85 '
             'Q33 63 47 44 Q65 25 87 36 Q107 45 107 73 L149 73 '
             'Q149 45 169 36 Q191 25 209 44 Q223 63 210 85 '
             'Q221 93 222 111 L224 168 Q226 203 202 221 '
             'Q174 238 128 238 Q82 238 54 221Z', '#a7ce2e', INK, 4.5)
    a += path('M45 139 Q58 108 87 99 L107 82 128 87 149 82 169 99 '
              'Q198 108 211 139 L209 194 200 211 Q211 154 177 132 '
              'L151 113 128 105 105 113 79 132 Q45 154 56 211 L47 194Z', '#648f30', 'none', 0)
    for x in (72, 184):
        a += ellipse(x, 60, 28, 26, '#eff1cd', INK, 4)
        a += path(f'M{x-18} 57 {x-8} 55 Q{x} 40 {x+8} 54 L{x+18} 56 '
                  f'{x+12} 65 {x+5} 66 Q{x-7} 76 {x-11} 65 L{x-19} 64Z', '#23452b', 'none', 0)
    a += ellipse(119, 92, 3, 4, '#63872a') + ellipse(137, 92, 3, 4, '#63872a')
    a += face()
    a += path('M66 125 83 117 98 130 115 116 128 126 141 116 158 130 173 117 190 125 '
              'L177 139 171 131 157 141 141 128 128 138 115 128 99 141 84 131 77 139Z', '#614395', INK, 3)
    eye = path('M71 155 Q87 147 106 158 L116 168 Q97 185 77 176 Q69 169 71 155Z', '#fffbde', '#294728', 3)
    a += eye + f'<g transform="translate(256 0) scale(-1 1)">{eye}</g>'
    for x in (92, 164):
        a += ellipse(x, 165, 15, 11, '#1e3925')
        a += ellipse(x-5, 162, 2.8, 2.5, '#fffce7') + ellipse(x+7, 168, 2.8, 2.5, '#fffce7')
    a += path('M70 152 Q90 146 116 163M186 152 Q166 146 140 163 '
              'M73 183 Q93 189 113 180M183 183 Q163 189 143 180', 'none', '#364b30', 3)
    a += BASE['base/blush'] + BASE['base/nose']
    a += path('M78 199 Q88 191 110 198 Q128 201 146 198 Q168 191 178 199 '
              'Q190 209 177 216 Q159 222 142 215 L114 215 Q97 222 79 216 Q66 209 78 199Z', '#dc8170', '#354530', 3.5)
    a += path('M81 205 Q103 210 128 207 Q153 210 175 207', 'none', '#733f37', 2.5)
    return a


def manga():
    a = path('M58 224 29 218 40 198 20 184 37 171 20 149 43 149 '
             'L29 122 54 131 48 94 70 113 75 68 95 102 100 48 '
             'L118 88 128 32 138 88 156 48 161 102 181 68 186 113 '
             'L208 94 202 131 227 122 213 149 236 149 219 171 236 184 '
             'L216 198 227 218 198 224 Q170 240 128 236 Q86 240 58 224Z', '#ebebea', INK, 4.5)
    a += path('M38 181 53 194 45 213 76 225 96 226 75 185 73 135 '
              'L91 143 86 100 109 127 114 89 128 124 142 89 147 127 '
              'L170 100 165 143 183 135 181 185 160 226 180 225 211 213 '
              'L203 194 218 181 201 175 184 163 155 137 128 143 101 137 72 163Z', '#b9b9ba', 'none', 0)
    a += face('#eeedeb', '#bebec1')
    a += path('M69 129 83 119 98 133 115 119 128 129 141 119 158 133 173 119 187 129 '
              'L179 167 151 179 128 192 105 179 77 167Z', '#9f9fa2', 'none', 0)
    for x in range(75, 169, 7):
        a += path(f'M{x} 137 {x+15} 161', 'none', '#4a4a50', 1)
    eye = path('M71 157 Q84 143 99 158 L114 173 Q95 186 77 178 Q71 170 71 157Z', '#fafaf5', INK, 3.5)
    a += eye + f'<g transform="translate(256 0) scale(-1 1)">{eye}</g>'
    for x in (92, 164):
        a += ellipse(x+2, 169, 10, 10, '#17171b', INK, 2)
        a += ellipse(x, 166, 2.6, 2.5, '#ecece9') + ellipse(x+3, 169, 6, 6, 'none', '#77777b', 1)
    a += path('M73 152 Q94 152 114 168M183 152 Q162 152 142 168', 'none', INK, 3.5)
    a += path('M62 183 65 203 83 210 98 206 102 190M194 183 191 203 173 210 158 206 154 190', 'none', '#77777a', 2)
    a += path('M70 188 74 201M78 190 82 204M186 188 182 201M178 190 174 204', 'none', '#aaa9aa', 1.5)
    a += path('M122 178 128 175 134 178 128 181Z', '#8c8c91', 'none', 0)
    a += path('M116 207 140 204 137 211Z', '#fafaf6', 'none', 0)
    a += path('M116 207 140 204M123 215 135 214', 'none', '#333238', 2.5)
    return a


def angel():
    a = fur('#e6d499', '#c6b681', '#fff5ca') + face('#f4e6b8', '#decf9e')
    for x in (92, 164):
        a += ellipse(x, 170, 18, 18, '#18191a')
        a += ellipse(x-6, 163, 4.5, 6, '#fff8d8')
    a += path('M72 148 112 148 112 162 72 162Z M144 148 184 148 184 162 144 162Z', '#f4e6b8', 'none', 0)
    a += path('M72 158 112 158 112 164 72 164Z M144 158 184 158 184 164 144 164Z', '#fff9dc', 'none', 0)
    a += BASE['base/blush'] + BASE['base/nose']
    a += path('M120 207 136 202', 'none', '#36332b', 4)
    a += ellipse(128, 49, 99, 17, 'none', INK, 12)
    a += ellipse(128, 49, 99, 17, 'none', '#edb626', 8)
    a += path('M33 46 Q59 30 128 32 Q197 30 223 46', 'none', '#fff391', 3.5)
    return a


def gladius():
    a = fur('#8537b7', '#54267b', '#c25ce1') + face()
    a += path('M86 176 97 177 100 227 88 223Z M159 177 170 176 168 223 156 227Z', '#df5a9a', 'none', 0)
    eye = path('M69 155 Q89 146 109 158 L116 175 Q95 185 73 178Z', '#fff7dd', INK, 3)
    a += eye + f'<g transform="translate(256 0) scale(-1 1)">{eye}</g>'
    for x in (92, 164):
        a += ellipse(x+1, 168, 14, 19, '#a0d9dc', '#689eae', 2)
        a += path(f'M{x-11} 153 Q{x+1} 147 {x+13} 155 L{x+13} 167 {x-11} 171Z', '#976aaf', 'none', 0)
        a += path(f'M{x-10} 157 {x-2} 154 {x-2} 170 {x-10} 174Z', '#edfcf3', 'none', 0)
    a += path('M44 137 Q47 111 65 102 L78 83 Q94 106 128 107 '
              'Q162 106 178 83 L191 102 Q209 111 212 137 L198 146 195 124 '
              'Q173 133 143 132 L140 176 128 183 116 176 113 132 '
              'Q83 133 61 124 L58 146Z', '#f7d729', INK, 4)
    a += path('M53 126 Q62 104 78 95 Q98 115 128 115 Q158 115 178 95 '
              'Q194 104 203 126 L195 117 Q173 126 135 125 L132 174 128 177 '
              'L121 172 120 125 Q83 126 61 117Z', '#dba619', 'none', 0)
    a += path('M61 128 Q80 137 112 137L117 174M144 137 Q176 136 195 128', 'none', '#fff581', 2.5)
    a += path('M108 104 Q108 78 128 61 Q148 78 148 104 Q128 115 108 104Z', '#fbe448', INK, 3)
    a += path('M116 99 124 73 139 84 141 99 127 106Z', '#d52939', '#6b2830', 2)
    a += path('M119 95 126 79 136 85M122 99 137 95', 'none', '#fff5bd', 2)
    a += path('M68 113 76 105 84 112 76 116ZM188 113 180 105 172 112 180 116Z', 'none', '#ae8415', 1.6)
    a += path('M116 204 140 203M123 211 135 210', 'none', '#502a44', 2.7)
    return a


def midas():
    a = fur('#f8d42a', '#d58b22', '#fff7a8')
    a += face('#ffdf35', '#e5a527').replace(INK, '#6d4225')
    a += path('M54 171 Q52 144 68 129 L81 121 87 128 Q65 143 64 173 '
              'Q63 199 80 214 L69 210 Q54 195 54 171Z', '#fffba4', 'none', 0)
    a += path('M86 227 Q128 239 170 227 L190 217 Q164 230 128 230 L103 224Z', '#bd7622', 'none', 0)
    a += path('M65 116 67 110 83 121M99 93 113 107M129 82 140 107M165 96 169 118', 'none', '#fff9bf', 5)
    a += path('M25 157 41 154 46 164 37 172Z M38 133 56 136 63 143 48 146Z', '#fff6af', 'none', 0)
    a += path('M58 164 Q57 142 71 130 L74 134 Q64 146 63 164 L65 187 Q59 179 58 164Z', '#fffbe0', 'none', 0)
    a += path('M92 219 Q128 231 164 219 L161 225 Q128 234 95 225Z', '#fff59b', 'none', 0)
    for x in (92, 164):
        a += ellipse(x, 170, 18, 23, '#e9a51c', '#9b5d24', 2.8)
        a += ellipse(x, 168, 13, 19, '#ffe84a')
        a += ellipse(x-5, 160, 6, 10, '#fffde4', rotate=24)
        a += ellipse(x+9, 173, 2.5, 3, '#fff7a7')
    a += path('M54 192 Q65 186 74 196 L77 205 Q64 213 56 204Z '
              'M202 192 Q191 186 182 196 L179 205 Q192 213 200 204Z', '#d78121', 'none', 0)
    a += path('M123 176 133 178 131 183 Q124 185 122 180Z', '#d48420', 'none', 0)
    a += path('M109 201 Q128 212 147 201', 'none', '#b87925', 3)
    a += path('M112 202 Q128 209 144 202', 'none', '#fff4b0', 2.5)
    return a


def devil():
    a = fur('#b7283d', '#871d30', '#ef5766') + face('#e9a2a4', '#cd777e')
    horn = path('M68 124 Q53 113 58 94 Q64 83 71 68 Q67 90 83 97 '
                'Q100 112 88 126 Q79 135 68 124Z', '#dc253b', INK, 3.5)
    a += horn + f'<g transform="translate(256 0) scale(-1 1)">{horn}</g>'
    a += path('M65 99 Q62 113 75 122M191 99 Q194 113 181 122', 'none', '#ffb4ab', 3)
    eye = path('M75 153 Q92 166 109 153 L111 165 Q113 188 94 189 Q75 188 73 172Z', '#3b1725', 'none', 0)
    a += eye + f'<g transform="translate(256 0) scale(-1 1)">{eye}</g>'
    a += path('M73 151 Q92 165 110 152M183 151 Q164 165 146 152', 'none', '#9e343f', 4)
    for x in (92, 164):
        a += ellipse(x, 171, 9, 10, '#b94150') + ellipse(x-2, 169, 5, 6, '#fff7e5')
        a += ellipse(x+9, 181, 2.5, 2.5, '#f8a1a8')
    a += BASE['base/blush'].replace(BLUSH, '#d84160') + BASE['base/nose'].replace('#d94d8c','#bd304b')
    a += path('M109 200 Q128 212 147 199', 'none', '#582733', 3)
    a += path('M139 204 140 214 146 211 147 199Z', '#fff4d9', '#582733', 2)
    return a


def pack(images):
    atlas = Image.new('RGBA', (1024, 1024))
    frames, x, y, row_h = {}, 2, 2, 0
    for name, im in images.items():
        box = im.getbbox(); tile = im.crop(box); w, h = tile.size
        if x+w+2 > atlas.width:
            x, y, row_h = 2, y+row_h+4, 0
        assert y+h+2 <= atlas.height, 'legend atlas overflow'
        atlas.alpha_composite(tile, (x,y))
        frames[name] = {'frame':{'x':x,'y':y,'w':w,'h':h}, 'rotated':False, 'trimmed':True,
                        'spriteSourceSize':{'x':box[0],'y':box[1],'w':w,'h':h},
                        'sourceSize':{'w':256,'h':320}}
        x, row_h = x+w+4, max(row_h,h)
    atlas = atlas.crop((0,0,1024,y+row_h+2))
    save_png(ATLAS/'chog-legend.png', atlas)
    save_json(ATLAS/'chog-legend.json', {'frames':frames, 'meta':{
        'app':'Candy Siege legendary head masters','version':'1','image':'chog-legend.png',
        'format':'RGBA8888','size':{'w':atlas.width,'h':atlas.height},'scale':'1','padding':2}})
    return atlas, frames


def preview(compositor):
    # Reuse the body player. Only the in-memory head registration changes from portrait centre to neck.
    sys.path.insert(0, str(HERE.parent))
    from rig_preview import Player
    rig = json.loads((ATLAS/'rig.json').read_text())
    rig['costumes'] = {f'legend-{i}':rig['costumes'][f'legend-{i}'] for i in IDS}
    for config in rig['costumes'].values():
        config['joints']['head'][1] += rig['R']*.55
    # A complete head-front covers the old portrait collar and lets drool hang over the torso.
    rig['order'].remove('head')
    rig['order'].insert(rig['order'].index('torso')+1, 'head')
    player = Player(rig)
    legends = json.loads((DATA/'legends.json').read_text())['legends']
    sheet = Image.new('RGBA',(1512,150+len(IDS)*300),'#f3eee3')
    d = ImageDraw.Draw(sheet)
    d.text((24,20),'CHOG / TEN LEGENDARY HEADS / FRONT-FACING',font=font(28),fill=INK)
    d.text((24,62),'compose.py output + matching hero bodies, both facings + 64px heads / neck (128,230)',font=font(16),fill='#665c68')
    for x,label in ((24,'NFT REFERENCE'),(260,'FULL HEAD'),(550,'HERO / RIGHT'),(850,'HERO / LEFT'),(1160,'PHONE SIZE')):
        d.text((x,110),label,font=font(14),fill='#665c68')
    for n, token in enumerate(IDS):
        y = 150+n*300
        d.rounded_rectangle((12,y+3,1500,y+292),radius=12,fill='#eae3d7' if n%2 else '#eee8dd')
        with Image.open(DATA.parent/'chogs-256'/f'{token}.webp') as src:
            sheet.alpha_composite(src.convert('RGBA').resize((180,180),Image.Resampling.LANCZOS),(24,y+26))
        d.text((24,y+220),f"#{token} / {legends[str(token)]['name']}",font=font(17),fill=INK)
        # Exercise the public CLI for this real one-of-one in both facings.
        heads = []
        with tempfile.TemporaryDirectory(prefix='chog-legend-check-') as directory:
            for left in (False, True):
                output = Path(directory) / ('left.png' if left else 'right.png')
                temporary = output.with_suffix('.tmp.png')
                command = [sys.executable, '-B', str(HERE/'compose.py'), str(token)]
                if left:
                    command.append('--left')
                subprocess.run(command + ['-o', str(temporary)], check=True, capture_output=True)
                temporary.replace(output)
                with Image.open(output) as composed:
                    heads.append(composed.convert('RGBA'))
        head, left_head = heads
        assert ImageChops.difference(head, compositor.layer(f'legend/{token}/front','#ffffff')).getbbox(alpha_only=False) is None
        assert ImageChops.difference(left_head, ImageOps.mirror(head)).getbbox(alpha_only=False) is None
        sheet.alpha_composite(head,(250,y-4))
        # Cross marks neck only in the standalone study, not in atlas art.
        nx,ny=ANCHORS['neck'];d.line((250+nx-4,y-4+ny,250+nx+4,y-4+ny),fill='#c86340',width=1)
        d.text((282,y+264),'neck (128,230)',font=font(12),fill='#8b675c')
        player.heads[token] = (head,tuple(ANCHORS['neck']),.5)
        character = player.draw(f'legend-{token}','idle',0,token,size=(300,300),origin=(150,281),scale=1.62)
        sheet.alpha_composite(character,(520,y-6))
        player.heads[token] = (ImageOps.mirror(left_head), tuple(ANCHORS['neck']), .5)
        left_character = ImageOps.mirror(player.draw(f'legend-{token}','idle',0,token,size=(300,300),origin=(150,281),scale=1.62))
        sheet.alpha_composite(left_character,(820,y-6))
        # Scale by visible head width so each small head is exactly 64 pixels wide.
        small_scale = 64 / ((head.getbbox()[2]-head.getbbox()[0])*.5)
        small = player.draw(f'legend-{token}','idle',0,token,size=(176,220),origin=(88,205),scale=small_scale)
        sheet.alpha_composite(small,(1140,y+20))
        sheet.alpha_composite(ImageOps.mirror(small),(1310,y+20))
        d.text((1180,y+252),'right',font=font(12),fill='#665c68')
        d.text((1360,y+252),'left',font=font(12),fill='#665c68')
    save_png(HERE/'preview-legend.png',sheet)


def self_check(compositor,images,atlas,frames):
    assert set(images)=={f'legend/{i}/front' for i in IDS}
    for name,original in images.items():
        restored=compositor.layer(name,'#ffffff')
        assert ImageChops.difference(original,restored).getbbox(alpha_only=False) is None,name
        left=compositor.layer(name,'#ffffff',left=True)
        assert ImageChops.difference(left,ImageOps.mirror(original)).getbbox(alpha_only=False) is None,name
        box=original.getbbox()
        assert box[0]>=2 and box[1]>=2 and box[2]<=254 and box[3]<=318,name
        assert original.getpixel(tuple(ANCHORS['neck']))[3]>0,(name,'disconnected neck')
        f=frames[name]['frame'];x,y,w,h=(f[k] for k in ('x','y','w','h'))
        for pad in ((x-2,y-2,x+w+2,y),(x-2,y+h,x+w+2,y+h+2),(x-2,y,x,y+h),(x+w,y,x+w+2,y+h)):
            assert atlas.crop(pad).getbbox() is None,(name,'nontransparent padding')
    assert max(atlas.size)<=2048


def main():
    makers=(ember,skull,scream,zombie,frog,manga,angel,gladius,midas,devil)
    images={}
    for token,make in zip(IDS,makers):
        name=f'legend/{token}/front'; master=HERE/'svg'/f'{name}.svg'
        write(master,svg(name,make()))
        rendered=subprocess.run(['rsvg-convert',str(master)],check=True,capture_output=True).stdout
        images[name]=Image.open(io.BytesIO(rendered)).convert('RGBA')
    atlas,frames=pack(images)
    compositor=Compositor()
    self_check(compositor,images,atlas,frames)
    preview(compositor)
    print(f'PASS: {len(images)} heads; 20 compose.py CLI renders, trim restoration, left facing, neck, canvas bounds and 2px padding. Atlas {atlas.width}x{atlas.height}.')
    print(HERE/'preview-legend.png')


if __name__=='__main__':
    main()
